window.RDLife = window.RDLife || {};

(function registerSimulationConstants(ns) {
  ns.constants = ns.constants || {};
  ns.constants.simulation = {
    defaultStepsPerSecond: 5,
    maxStepsPerFrame: 2,
    maxAccumulatedStepLag: 2,
    defaultBirthRule: [3],
    defaultSurvivalRule: [2, 4],
    defaultRandomCellCount: 16
  };
})(window.RDLife);
