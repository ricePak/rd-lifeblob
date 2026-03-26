window.RDLife = window.RDLife || {};

(function registerScene(ns) {
  const colors = ns.constants.colors;
  const sceneConstants = ns.constants.scene;
  const orbitDefaults = sceneConstants.orbit;

  ns.createSceneSystem = function createSceneSystem(container) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.background);
    scene.fog = new THREE.FogExp2(colors.background, sceneConstants.fogDensity);
    const rendererDefaults = sceneConstants.renderer;

    // Keep camera state in spherical coordinates so orbit interactions
    // are easier to reason about than raw XYZ mutations.
    const camera = new THREE.PerspectiveCamera(
      sceneConstants.camera.fov,
      window.innerWidth / window.innerHeight,
      sceneConstants.camera.near,
      sceneConstants.camera.far
    );
    camera.position.set(
      sceneConstants.camera.position.x,
      sceneConstants.camera.position.y,
      sceneConstants.camera.position.z
    );
    camera.lookAt(0, 0, 0);

    function createRenderer() {
      const baseRendererOptions = {
        antialias: rendererDefaults.antialias,
        alpha: false,
        depth: true,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: rendererDefaults.powerPreference
      };

      try {
        return new THREE.WebGLRenderer(Object.assign({}, baseRendererOptions, {
          failIfMajorPerformanceCaveat: rendererDefaults.failIfMajorPerformanceCaveat
        }));
      } catch (preferredRendererError) {
        if (!rendererDefaults.allowPerformanceCaveatFallback) {
          throw preferredRendererError;
        }

        return new THREE.WebGLRenderer(Object.assign({}, baseRendererOptions, {
          failIfMajorPerformanceCaveat: false
        }));
      }
    }

    const renderer = createRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, rendererDefaults.maxPixelRatio));
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(
      sceneConstants.lights.ambient.color,
      sceneConstants.lights.ambient.intensity
    );
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(
      sceneConstants.lights.key.color,
      sceneConstants.lights.key.intensity
    );
    dirLight.position.set(
      sceneConstants.lights.key.position.x,
      sceneConstants.lights.key.position.y,
      sceneConstants.lights.key.position.z
    );
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(
      sceneConstants.lights.fill.color,
      sceneConstants.lights.fill.intensity
    );
    dirLight2.position.set(
      sceneConstants.lights.fill.position.x,
      sceneConstants.lights.fill.position.y,
      sceneConstants.lights.fill.position.z
    );
    scene.add(dirLight2);

    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    const spherical = {
      theta: orbitDefaults.theta,
      phi: orbitDefaults.phi,
      radius: orbitDefaults.radius
    };

    function updateCamera() {
      // Convert orbit controls into cartesian camera coordinates and keep
      // the simulation centered as the look target.
      camera.position.set(
        spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta),
        spherical.radius * Math.cos(spherical.phi),
        spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta)
      );
      camera.lookAt(0, 0, 0);
    }

    renderer.domElement.addEventListener("pointerdown", function onPointerDown(event) {
      isDragging = true;
      prevMouse = { x: event.clientX, y: event.clientY };
    });

    window.addEventListener("pointerup", function onPointerUp() {
      isDragging = false;
    });

    window.addEventListener("pointermove", function onPointerMove(event) {
      if (!isDragging) {
        return;
      }

      // Clamp phi slightly away from 0 and PI to avoid gimbal-like
      // camera flips at the poles.
      const dx = event.clientX - prevMouse.x;
      const dy = event.clientY - prevMouse.y;

      spherical.theta -= dx * orbitDefaults.dragSensitivity;
      spherical.phi = Math.max(
        orbitDefaults.minPhi,
        Math.min(Math.PI - orbitDefaults.minPhi, spherical.phi + dy * orbitDefaults.dragSensitivity)
      );
      prevMouse = { x: event.clientX, y: event.clientY };
      updateCamera();
    });

    renderer.domElement.addEventListener("wheel", function onWheel(event) {
      spherical.radius = Math.max(
        orbitDefaults.minRadius,
        Math.min(orbitDefaults.maxRadius, spherical.radius + event.deltaY * orbitDefaults.zoomSensitivity)
      );
      updateCamera();
    }, { passive: true });

    window.addEventListener("resize", function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    updateCamera();

    return {
      scene,
      camera,
      renderer,
      render() {
        renderer.render(scene, camera);
      },
      autoRotate(speed = orbitDefaults.idleRotateSpeed) {
        spherical.theta += speed;
        updateCamera();
      },
      isDragging() {
        return isDragging;
      }
    };
  };
})(window.RDLife);
