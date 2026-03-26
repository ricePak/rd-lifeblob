window.RDLife = window.RDLife || {};

(function registerSceneConstants(ns) {
  const colors = ns.constants.colors;

  ns.constants.scene = {
    fogDensity: 0.01,
    renderer: {
      maxPixelRatio: 1.25,
      antialias: true,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: true,
      allowPerformanceCaveatFallback: true
    },
    camera: {
      fov: 50,
      near: 0.1,
      far: 400,
      position: { x: 12, y: 10, z: 14 }
    },
    lights: {
      ambient: { color: colors.ambientLight, intensity: 0.6 },
      key: { color: colors.white, intensity: 0.8, position: { x: 10, y: 15, z: 10 } },
      fill: { color: colors.accent, intensity: 0.3, position: { x: -10, y: -5, z: -10 } }
    },
    orbit: {
      theta: 0.8,
      phi: 1.0,
      radius: 40,
      minPhi: 0.1,
      maxRadius: 60,
      minRadius: 5,
      dragSensitivity: 0.008,
      zoomSensitivity: 0.05,
      idleRotateSpeed: 0.001
    }
  };
})(window.RDLife);
