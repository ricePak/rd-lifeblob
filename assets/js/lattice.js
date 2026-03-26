window.RDLife = window.RDLife || {};

(function registerLattice(ns) {
  const latticeConstants = ns.constants.lattice;
  const GRID_N = latticeConstants.GRID_N;
  const CELL_SPACING = latticeConstants.CELL_SPACING;
  const FCC_OFFSETS = latticeConstants.FCC_OFFSETS;
  const MAX_NEIGHBORS = latticeConstants.MAX_NEIGHBORS;

  function cellKey(i, j, k) {
    return `${i},${j},${k}`;
  }

  function createLattice(gridSize = GRID_N) {
    const cells = [];
    const cellIndex = {};
    const halfExtent = (gridSize - 1) * CELL_SPACING / 2;

    // FCC cells exist only on coordinates whose parity matches.
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        for (let k = 0; k < gridSize; k++) {
          if ((i + j + k) % 2 === 0) {
            const key = cellKey(i, j, k);
            cellIndex[key] = cells.length;
            cells.push({ i, j, k, key });
          }
        }
      }
    }

    const neighbors = new Array(cells.length);
    const neighborCounts = new Uint8Array(cells.length);
    const neighborIndexBuffer = new Int32Array(cells.length * MAX_NEIGHBORS);
    const worldPositions = new Float32Array(cells.length * 3);
    const sliceByIndex = new Uint16Array(cells.length);

    for (let idx = 0; idx < cells.length; idx++) {
      const cell = cells[idx];
      neighbors[idx] = [];
      sliceByIndex[idx] = cell.j;
      worldPositions[idx * 3] = cell.i * CELL_SPACING - halfExtent;
      worldPositions[idx * 3 + 1] = cell.j * CELL_SPACING - halfExtent;
      worldPositions[idx * 3 + 2] = cell.k * CELL_SPACING - halfExtent;

      // Neighbor lookup is precomputed once so simulation steps only do
      // fixed-size array walks instead of repeated coordinate math.
      for (const [di, dj, dk] of FCC_OFFSETS) {
        const nextKey = cellKey(cell.i + di, cell.j + dj, cell.k + dk);
        if (nextKey in cellIndex) {
          const neighborIndex = cellIndex[nextKey];
          neighbors[idx].push(neighborIndex);
          neighborIndexBuffer[idx * MAX_NEIGHBORS + neighborCounts[idx]] = neighborIndex;
          neighborCounts[idx] += 1;
        }
      }
    }

    return {
      gridSize,
      cellSpacing: CELL_SPACING,
      cells,
      cellIndex,
      neighbors,
      neighborCounts,
      neighborIndexBuffer,
      maxNeighbors: MAX_NEIGHBORS,
      worldPositions,
      sliceByIndex,
      numCells: cells.length,
      // World-space center offset lets the renderer place the lattice
      // around the origin while cell coordinates remain grid-relative.
      offset: new THREE.Vector3(
        halfExtent,
        halfExtent,
        halfExtent
      )
    };
  }

  ns.createLattice = createLattice;
})(window.RDLife);
