window.RDLife = window.RDLife || {};

(function registerLatticeConstants(ns) {
  ns.constants = ns.constants || {};
  ns.constants.lattice = {
    GRID_N: 20,
    CELL_SPACING: 1.5,
    MAX_NEIGHBORS: 12,
    FCC_OFFSETS: [
      [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
      [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
      [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]
    ],
    PRESETS: [
      { name: "Overcrowd", birth: [2, 3], survival: [3, 4], initCount: 30 },
      { name: "Firework", birth: [1], survival: [1], initCount: 1 },
      { name: "Symmetry", birth: [1], survival: [12], initCount: 1 },
      { name: "Reduction", birth: [4, 6], survival: [3, 4, 5], initCount: 500 }
    ]
  };
})(window.RDLife);
