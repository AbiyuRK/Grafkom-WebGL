"use strict";

// Utility functions for parsing and processing OBJ and MTL data
function parseVertexData(parts, dataArray) {
  dataArray.push(parts.map(parseFloat));
}

function processVertexIndex(vert, objVertexData, webglVertexData, geometry) {
  const ptn = vert.split("/");
  ptn.forEach((objIndexStr, i) => {
    if (objIndexStr) {
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
      if (i === 0 && objVertexData[3]?.length > 1) {
        geometry.data.color.push(...objVertexData[3][index]);
      }
    }
  });
}

export function parseOBJ(text) {
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];
  const objColors = [[0, 0, 0]];
  
  const objVertexData = [objPositions, objTexcoords, objNormals, objColors];

  let webglVertexData = [[], [], [], []];
  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ["default"];
  let material = "default";
  let object = "default";

  const noop = () => {};

  function newGeometry() {
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      const color = [];
      webglVertexData = [position, texcoord, normal, color];
      geometry = {
        object,
        groups,
        material,
        data: { position, texcoord, normal, color }
      };
      geometries.push(geometry);
    }
  }

  const keywords = {
    v(parts) {
      if (parts.length > 3) {
        parseVertexData(parts.slice(0, 3), objPositions);
        parseVertexData(parts.slice(3), objColors);
      } else {
        parseVertexData(parts, objPositions);
      }
    },
    vn(parts) {
      parseVertexData(parts, objNormals);
    },
    vt(parts) {
      parseVertexData(parts, objTexcoords);
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        processVertexIndex(parts[0], objVertexData, webglVertexData, geometry);
        processVertexIndex(parts[tri + 1], objVertexData, webglVertexData, geometry);
        processVertexIndex(parts[tri + 2], objVertexData, webglVertexData, geometry);
      }
    },
    s: noop,
    mtllib(parts, unparsedArgs) {
      materialLibs.push(unparsedArgs);
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");

  // Parse the OBJ file line by line
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      return;
    }
    const match = keywordRE.exec(trimmedLine);
    if (!match) return;

    const [, keyword, unparsedArgs] = match;
    const parts = trimmedLine.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    
    if (handler) {
      handler(parts, unparsedArgs);
    } else {
      console.warn("Unhandled keyword:", keyword);
    }
  });

  // Clean up geometry data (remove empty arrays)
  geometries.forEach(geometry => {
    geometry.data = Object.fromEntries(
      Object.entries(geometry.data).filter(([, array]) => array.length > 0)
    );
  });

  return { geometries, materialLibs };
}

export function parseMapArgs(unparsedArgs) {
  return unparsedArgs; // No processing needed
}

export function parseMTL(text) {
  const materials = {};
  let material;

  const keywords = {
    newmtl(parts, unparsedArgs) {
      material = {};
      materials[unparsedArgs] = material;
    },
    Ns(parts) {
      material.shininess = parseFloat(parts[0]);
    },
    Ka(parts) {
      material.ambient = parts.map(parseFloat);
    },
    Kd(parts) {
      material.diffuse = parts.map(parseFloat);
    },
    Ks(parts) {
      material.specular = parts.map(parseFloat);
    },
    Ke(parts) {
      material.emissive = parts.map(parseFloat);
    },
    Ni(parts) {
      material.opticalDensity = parseFloat(parts[0]);
    },
    d(parts) {
      material.opacity = parseFloat(parts[0]);
    },
    illum(parts) {
      material.illum = parseInt(parts[0]);
    },
    map_Kd(parts, unparsedArgs) {
      material.mapDiffuse = parseMapArgs(unparsedArgs);
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split("\n");

  // Parse the MTL file line by line
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      return;
    }
    const match = keywordRE.exec(trimmedLine);
    if (!match) return;

    const [, keyword, unparsedArgs] = match;
    const parts = trimmedLine.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    
    if (handler) {
      handler(parts, unparsedArgs);
    } else {
      console.warn("Unhandled keyword:", keyword);
    }
  });

  return materials;
}
