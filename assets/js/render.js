window.RDLife = window.RDLife || {};

(function registerRender(ns) {
  const colors = ns.constants.colors;
  const renderConstants = ns.constants.render;
  const marchingCubesConstants = ns.constants.marchingCubes;

  function hexToNormalizedRgb(hexColor) {
    const colorValue = typeof hexColor === "string" ? Number(hexColor) : hexColor;

    return [
      ((colorValue >> 16) & 255) / 255,
      ((colorValue >> 8) & 255) / 255,
      (colorValue & 255) / 255
    ];
  }

  function marchingCubes(scalarField, resX, resY, resZ, minX, minY, minZ, stepX, stepY, stepZ, isoLevel) {
    const positions = [];
    const edgeTable = marchingCubesConstants.edgeTable;
    const triTable = marchingCubesConstants.triTable;
    const edgeVerts = new Float32Array(36);
    const planeStride = resX * resY;

    function interpEdge(edgeIndex, ax, ay, az, bx, by, bz, v1, v2) {
      let mu = 0.5;
      if (Math.abs(isoLevel - v1) >= 1e-6 && Math.abs(isoLevel - v2) >= 1e-6 && Math.abs(v1 - v2) >= 1e-6) {
        mu = (isoLevel - v1) / (v2 - v1);
      }

      const base = edgeIndex * 3;
      edgeVerts[base] = ax + mu * (bx - ax);
      edgeVerts[base + 1] = ay + mu * (by - ay);
      edgeVerts[base + 2] = az + mu * (bz - az);
    }

    for (let iz = 0; iz < resZ - 1; iz++) {
      const z = minZ + iz * stepZ;
      const z1 = z + stepZ;
      const zPlane = iz * planeStride;
      const zPlaneNext = (iz + 1) * planeStride;

      for (let iy = 0; iy < resY - 1; iy++) {
        const y = minY + iy * stepY;
        const y1 = y + stepY;
        const row = iy * resX;
        const rowNext = (iy + 1) * resX;

        for (let ix = 0; ix < resX - 1; ix++) {
          const x = minX + ix * stepX;
          const x1 = x + stepX;

          const v0 = scalarField[ix + row + zPlane];
          const v1 = scalarField[ix + 1 + row + zPlane];
          const v2 = scalarField[ix + 1 + rowNext + zPlane];
          const v3 = scalarField[ix + rowNext + zPlane];
          const v4 = scalarField[ix + row + zPlaneNext];
          const v5 = scalarField[ix + 1 + row + zPlaneNext];
          const v6 = scalarField[ix + 1 + rowNext + zPlaneNext];
          const v7 = scalarField[ix + rowNext + zPlaneNext];

          let cubeIndex = 0;
          if (v0 >= isoLevel) cubeIndex |= 1;
          if (v1 >= isoLevel) cubeIndex |= 2;
          if (v2 >= isoLevel) cubeIndex |= 4;
          if (v3 >= isoLevel) cubeIndex |= 8;
          if (v4 >= isoLevel) cubeIndex |= 16;
          if (v5 >= isoLevel) cubeIndex |= 32;
          if (v6 >= isoLevel) cubeIndex |= 64;
          if (v7 >= isoLevel) cubeIndex |= 128;

          const edges = edgeTable[cubeIndex];
          if (edges === 0) {
            continue;
          }

          if (edges & 1) interpEdge(0, x, y, z, x1, y, z, v0, v1);
          if (edges & 2) interpEdge(1, x1, y, z, x1, y1, z, v1, v2);
          if (edges & 4) interpEdge(2, x1, y1, z, x, y1, z, v2, v3);
          if (edges & 8) interpEdge(3, x, y1, z, x, y, z, v3, v0);
          if (edges & 16) interpEdge(4, x, y, z1, x1, y, z1, v4, v5);
          if (edges & 32) interpEdge(5, x1, y, z1, x1, y1, z1, v5, v6);
          if (edges & 64) interpEdge(6, x1, y1, z1, x, y1, z1, v6, v7);
          if (edges & 128) interpEdge(7, x, y1, z1, x, y, z1, v7, v4);
          if (edges & 256) interpEdge(8, x, y, z, x, y, z1, v0, v4);
          if (edges & 512) interpEdge(9, x1, y, z, x1, y, z1, v1, v5);
          if (edges & 1024) interpEdge(10, x1, y1, z, x1, y1, z1, v2, v6);
          if (edges & 2048) interpEdge(11, x, y1, z, x, y1, z1, v3, v7);

          const triangles = triTable[cubeIndex];
          for (let t = 0; t < triangles.length; t += 3) {
            if (triangles[t] === -1) {
              break;
            }

            for (let j = 0; j < 3; j++) {
              const edgeOffset = triangles[t + j] * 3;
              positions.push(
                edgeVerts[edgeOffset],
                edgeVerts[edgeOffset + 1],
                edgeVerts[edgeOffset + 2]
              );
            }
          }
        }
      }
    }

    return positions;
  }

  ns.createRenderSystem = function createRenderSystem(options) {
    const lattice = options.lattice;
    const scene = options.scene;
    const getSimulation = options.getSimulation;
    const worldPositions = lattice.worldPositions;
    const sliceByIndex = lattice.sliceByIndex;
    const neighborCounts = lattice.neighborCounts;
    const neighborIndexBuffer = lattice.neighborIndexBuffer;
    const maxNeighbors = lattice.maxNeighbors;
    const allSlicesValue = renderConstants.allSlicesValue;

    // Separate materials let us color persistent, born, and dying cells
    // without splitting the simulation state itself.
    const STATE_ALIVE = 0;
    const STATE_BORN = 1;
    const STATE_DYING = 2;
    const stateColors = [
      hexToNormalizedRgb(colors.aliveSpecular),
      hexToNormalizedRgb(colors.bornSpecular),
      hexToNormalizedRgb(colors.dyingSpecular)
    ];

    const metaMat = new THREE.MeshPhongMaterial(renderConstants.materials.meta);
    let metaMesh = null;

    const nucleusGroup = new THREE.Group();
    scene.add(nucleusGroup);

    let currentSlice = allSlicesValue;
    const blobRadius = renderConstants.baseBlobRadiusScale * lattice.cellSpacing;
    const blobRadiusSquared = blobRadius * blobRadius;
    let blobAffinity = renderConstants.defaultBlobAffinity;
    let mcResolution = renderConstants.defaultResolution;
    let dynamicResolutionScale = 1;
    let playbackMeshInterval = 1000 / renderConstants.defaultPlaybackMeshUpdatesPerSecond;
    let smoothShading = renderConstants.smoothShadingByDefault;
    let showBoundaries = renderConstants.showBoundariesByDefault;
    let boundaryAliveOpacity = renderConstants.defaultBoundaryAliveOpacity;
    let boundaryAdjacentOpacity = renderConstants.defaultBoundaryAdjacentOpacity;
    let meshDirty = true;
    let boundariesDirty = true;
    let lastMeshRefreshTime = -Infinity;
    metaMat.flatShading = !smoothShading;

    const activeIndices = [];
    const activeStates = [];
    const boundaryAliveIndices = [];
    const boundaryAdjacentIndices = [];
    const adjacentMarks = new Uint8Array(lattice.numCells);
    const markedAdjacentIndices = [];

    const latticeScale = lattice.cellSpacing * renderConstants.latticeScaleFactor;
    // Precompute one canonical rhombic-dodecahedron wireframe and stamp it
    // at each cell position instead of rebuilding per-cell geometry.
    const rdUnitEdgeVerts = (function buildRdEdges() {
      const vertices = [
        [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
        [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
        [-2, 0, 0], [2, 0, 0], [0, -2, 0], [0, 2, 0], [0, 0, -2], [0, 0, 2]
      ].map(function scaleVertex(vertex) {
        return [vertex[0] * latticeScale, vertex[1] * latticeScale, vertex[2] * latticeScale];
      });

      const cubeCoords = [
        [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
        [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1]
      ];
      const octaCoords = [[-2, 0, 0], [2, 0, 0], [0, -2, 0], [0, 2, 0], [0, 0, -2], [0, 0, 2]];
      const edgeVertices = [];

      for (let oi = 0; oi < octaCoords.length; oi++) {
        const octaCoord = octaCoords[oi];
        const axis = octaCoord[0] !== 0 ? 0 : (octaCoord[1] !== 0 ? 1 : 2);
        const sign = octaCoord[axis] > 0 ? 1 : -1;

        for (let ci = 0; ci < cubeCoords.length; ci++) {
          if ((cubeCoords[ci][axis] > 0 ? 1 : -1) === sign) {
            edgeVertices.push(
              vertices[ci][0], vertices[ci][1], vertices[ci][2],
              vertices[8 + oi][0], vertices[8 + oi][1], vertices[8 + oi][2]
            );
          }
        }
      }

      return new Float32Array(edgeVertices);
    })();

    const boundaryAliveMat = new THREE.LineBasicMaterial({
      color: renderConstants.boundaries.color,
      transparent: true,
      opacity: boundaryAliveOpacity,
      depthWrite: false
    });

    const boundaryAdjacentMat = new THREE.LineBasicMaterial({
      color: renderConstants.boundaries.color,
      transparent: true,
      opacity: boundaryAdjacentOpacity,
      depthWrite: false
    });

    let boundaryAliveObj = null;
    let boundaryAdjacentObj = null;
    const boundaryGroup = new THREE.Group();
    scene.add(boundaryGroup);

    const boxGeo = new THREE.BoxGeometry(
      (lattice.gridSize - 1) * lattice.cellSpacing + renderConstants.boxPadding,
      (lattice.gridSize - 1) * lattice.cellSpacing + renderConstants.boxPadding,
      (lattice.gridSize - 1) * lattice.cellSpacing + renderConstants.boxPadding
    );
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({
      color: renderConstants.box.color,
      transparent: true,
      opacity: renderConstants.boxOpacity
    }));
    scene.add(boxLine);

    function disposeMesh(parent, mesh) {
      if (!mesh) {
        return null;
      }

      parent.remove(mesh);
      mesh.geometry.dispose();
      return null;
    }

    function isSliceVisible(index) {
      return currentSlice === allSlicesValue || sliceByIndex[index] === currentSlice;
    }

    function stampCellEdges(target, writeOffset, cellIndex) {
      const positionOffset = cellIndex * 3;
      const cx = worldPositions[positionOffset];
      const cy = worldPositions[positionOffset + 1];
      const cz = worldPositions[positionOffset + 2];

      for (let i = 0; i < rdUnitEdgeVerts.length; i += 3) {
        target[writeOffset++] = rdUnitEdgeVerts[i] + cx;
        target[writeOffset++] = rdUnitEdgeVerts[i + 1] + cy;
        target[writeOffset++] = rdUnitEdgeVerts[i + 2] + cz;
      }

      return writeOffset;
    }

    function buildLineGeometry(indices) {
      if (indices.length === 0) {
        return null;
      }

      const positions = new Float32Array(indices.length * rdUnitEdgeVerts.length);
      let writeOffset = 0;

      for (let i = 0; i < indices.length; i++) {
        writeOffset = stampCellEdges(positions, writeOffset, indices[i]);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      return geometry;
    }

    function clearAdjacentMarks() {
      for (let i = 0; i < markedAdjacentIndices.length; i++) {
        adjacentMarks[markedAdjacentIndices[i]] = 0;
      }
      markedAdjacentIndices.length = 0;
    }

    function rebuildBoundaries() {
      boundaryAliveObj = disposeMesh(boundaryGroup, boundaryAliveObj);
      boundaryAdjacentObj = disposeMesh(boundaryGroup, boundaryAdjacentObj);

      clearAdjacentMarks();
      boundaryAliveIndices.length = 0;
      boundaryAdjacentIndices.length = 0;

      if (!showBoundaries) {
        return;
      }

      const simulation = getSimulation();

      for (let idx = 0; idx < lattice.numCells; idx++) {
        if (!isSliceVisible(idx)) {
          continue;
        }

        const alive = simulation.state[idx];
        const wasAlive = simulation.prevState[idx];
        if (alive === 0 && wasAlive === 0) {
          continue;
        }

        boundaryAliveIndices.push(idx);

        const neighborBase = idx * maxNeighbors;
        for (let n = 0; n < neighborCounts[idx]; n++) {
          const neighborIndex = neighborIndexBuffer[neighborBase + n];
          if (!isSliceVisible(neighborIndex)) {
            continue;
          }

          if (simulation.state[neighborIndex] === 0 && simulation.prevState[neighborIndex] === 0 && adjacentMarks[neighborIndex] === 0) {
            adjacentMarks[neighborIndex] = 1;
            markedAdjacentIndices.push(neighborIndex);
            boundaryAdjacentIndices.push(neighborIndex);
          }
        }
      }

      const aliveGeometry = buildLineGeometry(boundaryAliveIndices);
      if (aliveGeometry) {
        boundaryAliveObj = new THREE.LineSegments(aliveGeometry, boundaryAliveMat);
        boundaryGroup.add(boundaryAliveObj);
      }

      const adjacentGeometry = buildLineGeometry(boundaryAdjacentIndices);
      if (adjacentGeometry) {
        boundaryAdjacentObj = new THREE.LineSegments(adjacentGeometry, boundaryAdjacentMat);
        boundaryGroup.add(boundaryAdjacentObj);
      }

      clearAdjacentMarks();
    }

    function resolveEffectiveResolution(isPlaying, activeCount) {
      if (!isPlaying || activeCount < renderConstants.adaptiveQualityCellThreshold) {
        return mcResolution;
      }

      return Math.max(
        renderConstants.minDynamicResolution,
        Math.floor(mcResolution * dynamicResolutionScale)
      );
    }

    function shouldExpandBounds(field, res, isoLevel) {
      const planeStride = res * res;

      for (let iz = 0; iz < res; iz++) {
        const zOffset = iz * planeStride;
        for (let iy = 0; iy < res; iy++) {
          const rowOffset = iy * res + zOffset;
          if (field[rowOffset] >= isoLevel || field[rowOffset + res - 1] >= isoLevel) {
            return true;
          }
        }
      }

      for (let iz = 0; iz < res; iz++) {
        const zOffset = iz * planeStride;
        for (let ix = 0; ix < res; ix++) {
          if (field[ix + zOffset] >= isoLevel || field[ix + (res - 1) * res + zOffset] >= isoLevel) {
            return true;
          }
        }
      }

      for (let iy = 0; iy < res; iy++) {
        const rowOffset = iy * res;
        for (let ix = 0; ix < res; ix++) {
          if (field[ix + rowOffset] >= isoLevel || field[ix + rowOffset + (res - 1) * planeStride] >= isoLevel) {
            return true;
          }
        }
      }

      return false;
    }

    function buildFieldData(activeCount, effectiveResolution, padMultiplier) {
      const sources = new Float32Array(activeCount * 4);
      let sourceMinX = Infinity;
      let sourceMinY = Infinity;
      let sourceMinZ = Infinity;
      let sourceMaxX = -Infinity;
      let sourceMaxY = -Infinity;
      let sourceMaxZ = -Infinity;

      for (let i = 0; i < activeCount; i++) {
        const idx = activeIndices[i];
        const stateIndex = activeStates[i];
        const positionOffset = idx * 3;
        const cx = worldPositions[positionOffset];
        const cy = worldPositions[positionOffset + 1];
        const cz = worldPositions[positionOffset + 2];
        const sourceOffset = i * 4;

        sources[sourceOffset] = cx;
        sources[sourceOffset + 1] = cy;
        sources[sourceOffset + 2] = cz;
        sources[sourceOffset + 3] = stateIndex;

        if (cx < sourceMinX) sourceMinX = cx;
        if (cy < sourceMinY) sourceMinY = cy;
        if (cz < sourceMinZ) sourceMinZ = cz;
        if (cx > sourceMaxX) sourceMaxX = cx;
        if (cy > sourceMaxY) sourceMaxY = cy;
        if (cz > sourceMaxZ) sourceMaxZ = cz;
      }

      const pad = blobRadius * padMultiplier;
      const bMinX = sourceMinX - pad;
      const bMinY = sourceMinY - pad;
      const bMinZ = sourceMinZ - pad;
      const bMaxX = sourceMaxX + pad;
      const bMaxY = sourceMaxY + pad;
      const bMaxZ = sourceMaxZ + pad;

      const spanX = bMaxX - bMinX;
      const spanY = bMaxY - bMinY;
      const spanZ = bMaxZ - bMinZ;
      const maxSpan = Math.max(spanX, spanY, spanZ);
      const targetVoxelSize = (blobRadius * 2) / renderConstants.minSamplesPerBlobDiameter;
      const adaptiveResolution = Math.min(
        renderConstants.maxAdaptiveResolution,
        Math.ceil(maxSpan / targetVoxelSize) + 1
      );
      const res = Math.min(
        renderConstants.maxAdaptiveResolution,
        Math.max(effectiveResolution, Math.min(adaptiveResolution, effectiveResolution + 12))
      );
      const stepX = spanX / (res - 1);
      const stepY = spanY / (res - 1);
      const stepZ = spanZ / (res - 1);
      const totalVoxels = res * res * res;
      const field = new Float32Array(totalVoxels);
      const strongestContribution = new Float32Array(totalVoxels);
      const wState = [
        new Float32Array(totalVoxels),
        new Float32Array(totalVoxels),
        new Float32Array(totalVoxels)
      ];
      const cutoffDistance = Math.sqrt(Math.max(
        blobRadiusSquared / renderConstants.minContribution - blobRadiusSquared * renderConstants.metaballFalloffBias,
        blobRadiusSquared
      ));
      const cutoffDistanceSquared = cutoffDistance * cutoffDistance;
      const planeStride = res * res;

      for (let sourceIndex = 0; sourceIndex < activeCount; sourceIndex++) {
        const sourceOffset = sourceIndex * 4;
        const sx = sources[sourceOffset];
        const sy = sources[sourceOffset + 1];
        const sz = sources[sourceOffset + 2];
        const stateIndex = sources[sourceOffset + 3];
        const minIX = Math.max(0, Math.floor((sx - cutoffDistance - bMinX) / stepX));
        const maxIX = Math.min(res - 1, Math.ceil((sx + cutoffDistance - bMinX) / stepX));
        const minIY = Math.max(0, Math.floor((sy - cutoffDistance - bMinY) / stepY));
        const maxIY = Math.min(res - 1, Math.ceil((sy + cutoffDistance - bMinY) / stepY));
        const minIZ = Math.max(0, Math.floor((sz - cutoffDistance - bMinZ) / stepZ));
        const maxIZ = Math.min(res - 1, Math.ceil((sz + cutoffDistance - bMinZ) / stepZ));

        for (let iz = minIZ; iz <= maxIZ; iz++) {
          const dz = bMinZ + iz * stepZ - sz;
          const dzSquared = dz * dz;
          const zOffset = iz * planeStride;

          for (let iy = minIY; iy <= maxIY; iy++) {
            const dy = bMinY + iy * stepY - sy;
            const dySquared = dy * dy;
            let voxelIndex = minIX + iy * res + zOffset;

            for (let ix = minIX; ix <= maxIX; ix++) {
              const dx = bMinX + ix * stepX - sx;
              const distanceSquared = dx * dx + dySquared + dzSquared;

              if (distanceSquared <= cutoffDistanceSquared) {
                const contribution = blobRadiusSquared / (
                  distanceSquared + blobRadiusSquared * renderConstants.metaballFalloffBias
                );
                field[voxelIndex] += contribution;
                if (contribution > strongestContribution[voxelIndex]) {
                  strongestContribution[voxelIndex] = contribution;
                }
                wState[stateIndex][voxelIndex] += contribution;
              }

              voxelIndex += 1;
            }
          }
        }
      }

      for (let i = 0; i < totalVoxels; i++) {
        field[i] = strongestContribution[i] + (field[i] - strongestContribution[i]) * blobAffinity;
      }

      return {
        field,
        wState,
        res,
        bMinX,
        bMinY,
        bMinZ,
        stepX,
        stepY,
        stepZ
      };
    }

    function sampleVolume(volume, fieldData, px, py, pz) {
      const res = fieldData.res;
      let gx = (px - fieldData.bMinX) / fieldData.stepX;
      let gy = (py - fieldData.bMinY) / fieldData.stepY;
      let gz = (pz - fieldData.bMinZ) / fieldData.stepZ;
      gx = Math.max(0, Math.min(res - 1.001, gx));
      gy = Math.max(0, Math.min(res - 1.001, gy));
      gz = Math.max(0, Math.min(res - 1.001, gz));

      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const iz = Math.floor(gz);
      const fx = gx - ix;
      const fy = gy - iy;
      const fz = gz - iz;
      const ix1 = Math.min(ix + 1, res - 1);
      const iy1 = Math.min(iy + 1, res - 1);
      const iz1 = Math.min(iz + 1, res - 1);
      const planeStride = res * res;

      const c000 = volume[ix + iy * res + iz * planeStride];
      const c100 = volume[ix1 + iy * res + iz * planeStride];
      const c010 = volume[ix + iy1 * res + iz * planeStride];
      const c110 = volume[ix1 + iy1 * res + iz * planeStride];
      const c001 = volume[ix + iy * res + iz1 * planeStride];
      const c101 = volume[ix1 + iy * res + iz1 * planeStride];
      const c011 = volume[ix + iy1 * res + iz1 * planeStride];
      const c111 = volume[ix1 + iy1 * res + iz1 * planeStride];

      return (
        c000 * (1 - fx) * (1 - fy) * (1 - fz) +
        c100 * fx * (1 - fy) * (1 - fz) +
        c010 * (1 - fx) * fy * (1 - fz) +
        c110 * fx * fy * (1 - fz) +
        c001 * (1 - fx) * (1 - fy) * fz +
        c101 * fx * (1 - fy) * fz +
        c011 * (1 - fx) * fy * fz +
        c111 * fx * fy * fz
      );
    }

    function buildSmoothNormalAttribute(positions) {
      const smoothNormals = new Float32Array(positions.length);
      const normalSums = new Map();
      const keyScale = renderConstants.smoothNormalKeyScale;

      function getVertexKey(x, y, z) {
        return `${Math.round(x * keyScale)},${Math.round(y * keyScale)},${Math.round(z * keyScale)}`;
      }

      function accumulateNormal(x, y, z, nx, ny, nz) {
        const key = getVertexKey(x, y, z);
        let normalSum = normalSums.get(key);

        if (!normalSum) {
          normalSum = [0, 0, 0];
          normalSums.set(key, normalSum);
        }

        normalSum[0] += nx;
        normalSum[1] += ny;
        normalSum[2] += nz;
      }

      for (let i = 0; i < positions.length; i += 9) {
        const ax = positions[i];
        const ay = positions[i + 1];
        const az = positions[i + 2];
        const bx = positions[i + 3];
        const by = positions[i + 4];
        const bz = positions[i + 5];
        const cx = positions[i + 6];
        const cy = positions[i + 7];
        const cz = positions[i + 8];

        const abx = bx - ax;
        const aby = by - ay;
        const abz = bz - az;
        const acx = cx - ax;
        const acy = cy - ay;
        const acz = cz - az;

        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        const normalLength = Math.hypot(nx, ny, nz);

        if (normalLength < 1e-8) {
          continue;
        }

        accumulateNormal(ax, ay, az, nx, ny, nz);
        accumulateNormal(bx, by, bz, nx, ny, nz);
        accumulateNormal(cx, cy, cz, nx, ny, nz);
      }

      for (let i = 0; i < positions.length; i += 3) {
        const normalSum = normalSums.get(getVertexKey(positions[i], positions[i + 1], positions[i + 2]));
        if (!normalSum) {
          smoothNormals[i + 2] = 1;
          continue;
        }

        const nx = normalSum[0];
        const ny = normalSum[1];
        const nz = normalSum[2];
        const length = Math.hypot(nx, ny, nz);

        if (length < 1e-8) {
          smoothNormals[i + 2] = 1;
          continue;
        }

        smoothNormals[i] = nx / length;
        smoothNormals[i + 1] = ny / length;
        smoothNormals[i + 2] = nz / length;
      }

      return new THREE.BufferAttribute(smoothNormals, 3);
    }

    function buildUnifiedMetaballMesh(isPlaying) {
      const activeCount = activeIndices.length;
      if (activeCount === 0) {
        return { mesh: null, activeCount: 0 };
      }

      const effectiveResolution = resolveEffectiveResolution(isPlaying, activeCount);
      let fieldData = null;
      let padMultiplier = renderConstants.metaballPaddingMultiplier;

      for (let pass = 0; pass < renderConstants.maxBoundsExpansionPasses; pass++) {
        fieldData = buildFieldData(activeCount, effectiveResolution, padMultiplier);
        if (!shouldExpandBounds(fieldData.field, fieldData.res, renderConstants.isoLevel)) {
          break;
        }
        padMultiplier *= renderConstants.metaballPaddingGrowthFactor;
      }

      const positions = marchingCubes(
        fieldData.field,
        fieldData.res,
        fieldData.res,
        fieldData.res,
        fieldData.bMinX,
        fieldData.bMinY,
        fieldData.bMinZ,
        fieldData.stepX,
        fieldData.stepY,
        fieldData.stepZ,
        renderConstants.isoLevel
      );

      if (positions.length === 0) {
        return { mesh: null, activeCount };
      }

      const colorArray = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        const w0 = sampleVolume(fieldData.wState[0], fieldData, positions[i], positions[i + 1], positions[i + 2]);
        const w1 = sampleVolume(fieldData.wState[1], fieldData, positions[i], positions[i + 1], positions[i + 2]);
        const w2 = sampleVolume(fieldData.wState[2], fieldData, positions[i], positions[i + 1], positions[i + 2]);

        let dominantState = STATE_ALIVE;
        if (w1 > w0 && w1 > w2) {
          dominantState = STATE_BORN;
        } else if (w2 > w0 && w2 > w1) {
          dominantState = STATE_DYING;
        }

        const color = stateColors[dominantState];
        colorArray[i] = color[0];
        colorArray[i + 1] = color[1];
        colorArray[i + 2] = color[2];
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));
      if (smoothShading) {
        geometry.setAttribute("normal", buildSmoothNormalAttribute(positions));
      } else {
        geometry.computeVertexNormals();
      }

      const mesh = new THREE.Mesh(geometry, metaMat);
      mesh.frustumCulled = false;

      return { mesh, activeCount };
    }

    function collectActiveCells() {
      const simulation = getSimulation();
      activeIndices.length = 0;
      activeStates.length = 0;

      for (let idx = 0; idx < lattice.numCells; idx++) {
        if (!isSliceVisible(idx)) {
          continue;
        }

        const alive = simulation.state[idx];
        const wasAlive = simulation.prevState[idx];
        if (!alive && !wasAlive) {
          continue;
        }

        activeIndices.push(idx);
        if (alive && wasAlive) {
          activeStates.push(STATE_ALIVE);
        } else if (alive) {
          activeStates.push(STATE_BORN);
        } else {
          activeStates.push(STATE_DYING);
        }
      }

      return activeIndices.length;
    }

    function tuneQuality(buildDuration, isPlaying, activeCount) {
      if (!isPlaying || activeCount < renderConstants.adaptiveQualityCellThreshold) {
        dynamicResolutionScale = Math.min(1, dynamicResolutionScale * renderConstants.qualityRecoveryRate);
        playbackMeshInterval = 1000 / renderConstants.defaultPlaybackMeshUpdatesPerSecond;
        return;
      }

      if (buildDuration > renderConstants.slowMeshBuildTimeMs) {
        dynamicResolutionScale = Math.max(
          renderConstants.minDynamicResolutionScale,
          dynamicResolutionScale * renderConstants.qualityDropRate
        );
        playbackMeshInterval = Math.min(
          1000 / renderConstants.minPlaybackMeshUpdatesPerSecond,
          playbackMeshInterval * 1.15
        );
      } else if (buildDuration < renderConstants.targetMeshBuildTimeMs) {
        dynamicResolutionScale = Math.min(1, dynamicResolutionScale * renderConstants.qualityRecoveryRate);
        playbackMeshInterval = Math.max(
          1000 / renderConstants.maxPlaybackMeshUpdatesPerSecond,
          playbackMeshInterval * 0.95
        );
      }
    }

    function refreshVisuals(time, isPlaying, force) {
      let refreshedMeshThisCycle = false;

      if (meshDirty && (force || !isPlaying || time - lastMeshRefreshTime >= playbackMeshInterval)) {
        collectActiveCells();
        metaMesh = disposeMesh(nucleusGroup, metaMesh);

        const buildStart = performance.now();
        const buildResult = buildUnifiedMetaballMesh(isPlaying);
        const buildDuration = performance.now() - buildStart;

        metaMesh = buildResult.mesh;
        if (metaMesh) {
          nucleusGroup.add(metaMesh);
        }

        meshDirty = false;
        lastMeshRefreshTime = time;
        refreshedMeshThisCycle = true;
        tuneQuality(buildDuration, isPlaying, buildResult.activeCount);
      }

      // Boundary geometry has to land on the same visual flush as the
      // metaball mesh so outlines never trail or lead the current blob frame.
      if (boundariesDirty && (force || refreshedMeshThisCycle)) {
        rebuildBoundaries();
        boundariesDirty = false;
      }
    }

    return {
      requestRefresh(config) {
        const settings = config || {};
        meshDirty = true;
        if (settings.refreshBoundaries !== false) {
          boundariesDirty = true;
        }

        if (settings.immediate) {
          refreshVisuals(performance.now(), getSimulation().playing, true);
        }
      },
      renderFrame(time, isPlaying) {
        refreshVisuals(time, isPlaying, false);
      },
      setSlice(value) {
        currentSlice = value;
      },
      setOpacity(value) {
        metaMat.opacity = value;
      },
      setBlobRadius(scale) {
        blobAffinity = scale;
      },
      setResolution(value) {
        mcResolution = value;
        dynamicResolutionScale = 1;
      },
      isSmoothShadingEnabled() {
        return smoothShading;
      },
      toggleSmoothShading() {
        smoothShading = !smoothShading;
        metaMat.flatShading = !smoothShading;
        metaMat.needsUpdate = true;
        meshDirty = true;
        refreshVisuals(performance.now(), getSimulation().playing, true);
        return smoothShading;
      },
      toggleBoundaries() {
        showBoundaries = !showBoundaries;
        boundariesDirty = true;

        if (!showBoundaries) {
          boundaryAliveObj = disposeMesh(boundaryGroup, boundaryAliveObj);
          boundaryAdjacentObj = disposeMesh(boundaryGroup, boundaryAdjacentObj);
        } else {
          refreshVisuals(performance.now(), getSimulation().playing, true);
        }

        return showBoundaries;
      },
      setBoundaryAliveOpacity(value) {
        boundaryAliveOpacity = value;
        boundaryAliveMat.opacity = boundaryAliveOpacity;
      },
      setBoundaryAdjacentOpacity(value) {
        boundaryAdjacentOpacity = value;
        boundaryAdjacentMat.opacity = boundaryAdjacentOpacity;
      }
    };
  };
})(window.RDLife);
