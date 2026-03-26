window.RDLife = window.RDLife || {};

(function registerRenderConstants(ns) {
  const colors = ns.constants.colors;

  ns.constants.render = {
    allSlicesValue: -1,
    defaultOpacity: 0.8,
    baseBlobRadiusScale: 0.55,
    defaultBlobAffinity: 0.90,
    defaultResolution: 64,
    defaultPlaybackMeshUpdatesPerSecond: 12,
    minPlaybackMeshUpdatesPerSecond: 6,
    maxPlaybackMeshUpdatesPerSecond: 18,
    smoothShadingByDefault: true,
    smoothNormalKeyScale: 100000,
    showBoundariesByDefault: true,
    defaultBoundaryAliveOpacity: 0.2,
    defaultBoundaryAdjacentOpacity: 0.05,
    latticeScaleFactor: 0.5,
    boxPadding: 1,
    boxOpacity: 0.3,
    metaballPaddingMultiplier: 2,
    metaballPaddingGrowthFactor: 1.75,
    metaballFalloffBias: 0.01,
    minSamplesPerBlobDiameter: 4,
    maxAdaptiveResolution: 96,
    maxBoundsExpansionPasses: 4,
    minDynamicResolutionScale: 0.55,
    minDynamicResolution: 18,
    adaptiveQualityCellThreshold: 90,
    targetMeshBuildTimeMs: 14,
    slowMeshBuildTimeMs: 28,
    qualityRecoveryRate: 1.05,
    qualityDropRate: 0.82,
    minContribution: 0.035,
    isoLevel: 1,
    materials: {
      meta: {
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        shininess: 80,
        specular: 0x333333,
        side: THREE.DoubleSide,
      }
    },
    boundaries: {
      color: colors.accent
    },
    box: {
      color: colors.panelBorder
    }
  };
})(window.RDLife);
