window.RDLife = window.RDLife || {};

(function bootstrapApp(ns) {
  const lattice = ns.createLattice();
  const simulationConstants = ns.constants.simulation;
  const renderConstants = ns.constants.render;
  const maxNeighborCount = ns.constants.lattice.MAX_NEIGHBORS + 1;
  const statElements = {
    generation: document.getElementById("gen-count"),
    alive: document.getElementById("alive-count"),
    fps: document.getElementById("fps-count"),
    grid: document.getElementById("grid-size")
  };
  const randomizeRange = {
    min: 1,
    max: Math.max(1, Math.floor(lattice.numCells * 0.1)),
    initial: simulationConstants.defaultRandomCellCount
  };

  function createRuleMask(values) {
    const mask = new Uint8Array(maxNeighborCount);
    values.forEach(function enableRuleValue(value) {
      if (value >= 0 && value < maxNeighborCount) {
        mask[value] = 1;
      }
    });
    return mask;
  }

  function replaceRuleMask(mask, values) {
    mask.fill(0);
    values.forEach(function enableRuleValue(value) {
      if (value >= 0 && value < maxNeighborCount) {
        mask[value] = 1;
      }
    });
  }

  // main.js owns authoritative simulation state and passes read/write hooks
  // into the renderer and UI instead of letting modules mutate each other.
  const simulation = {
    state: new Uint8Array(lattice.numCells),
    prevState: new Uint8Array(lattice.numCells),
    nextState: new Uint8Array(lattice.numCells),
    generation: 0,
    playing: false,
    stepsPerSecond: simulationConstants.defaultStepsPerSecond,
    birthRuleMask: createRuleMask(simulationConstants.defaultBirthRule),
    survivalRuleMask: createRuleMask(simulationConstants.defaultSurvivalRule)
  };
  const randomizePool = new Uint32Array(lattice.numCells);
  const randomizeFrontier = new Uint32Array(lattice.numCells);

  function updateStats() {
    statElements.generation.textContent = String(simulation.generation);
    statElements.alive.textContent = String(simulation.aliveCount);

    statElements.alive.classList.toggle("danger", !simulation.aliveCount);
  }

  function step() {
    // Preserve the previous generation so the renderer can color cells by
    // transition state (stable, born, or dying).
    const currentState = simulation.state;
    const nextState = simulation.nextState;
    const neighborCounts = lattice.neighborCounts;
    const neighborIndexBuffer = lattice.neighborIndexBuffer;
    const maxNeighbors = lattice.maxNeighbors;

    simulation.prevState.set(currentState);

    let nextAliveCount = 0;
    for (let idx = 0; idx < lattice.numCells; idx++) {
      let count = 0;
      const neighborBase = idx * maxNeighbors;
      for (let n = 0; n < neighborCounts[idx]; n++) {
        count += currentState[neighborIndexBuffer[neighborBase + n]];
      }

      const nextValue = currentState[idx] === 1
        ? simulation.survivalRuleMask[count]
        : simulation.birthRuleMask[count];
      nextState[idx] = nextValue;
      nextAliveCount += nextValue;
    }

    simulation.state = nextState;
    simulation.nextState = currentState;
    simulation.aliveCount = nextAliveCount;
    simulation.generation += 1;
    updateStats();
  }

  function randomize(cellCount) {
    simulation.prevState.fill(0);
    simulation.state.fill(0);
    simulation.nextState.fill(0);

    const targetCount = Math.max(randomizeRange.min, Math.min(randomizeRange.max, Math.floor(cellCount)));
    for (let idx = 0; idx < lattice.numCells; idx++) {
      randomizePool[idx] = idx;
    }

    // Shuffle once, then grow a few neighbor-connected blobs from those seeds.
    for (let i = 0; i < lattice.numCells; i++) {
      const swapIndex = i + Math.floor(Math.random() * (lattice.numCells - i));
      const picked = randomizePool[swapIndex];
      randomizePool[swapIndex] = randomizePool[i];
      randomizePool[i] = picked;
    }

    const clusterCount = Math.min(
      targetCount,
      Math.max(1, Math.min(8, Math.round(Math.sqrt(targetCount) / 2)))
    );
    const neighborCounts = lattice.neighborCounts;
    const neighborIndexBuffer = lattice.neighborIndexBuffer;
    const maxNeighbors = lattice.maxNeighbors;
    let poolCursor = 0;
    let frontierCount = 0;
    let aliveCount = 0;

    function seedCluster() {
      while (poolCursor < lattice.numCells) {
        const picked = randomizePool[poolCursor];
        poolCursor += 1;

        if (simulation.state[picked] === 1) {
          continue;
        }

        simulation.state[picked] = 1;
        randomizeFrontier[frontierCount] = picked;
        frontierCount += 1;
        aliveCount += 1;
        return true;
      }

      return false;
    }

    for (let i = 0; i < clusterCount; i++) {
      seedCluster();
    }

    while (aliveCount < targetCount) {
      if (frontierCount === 0) {
        if (!seedCluster()) {
          break;
        }
        continue;
      }

      const frontierSlot = Math.floor(Math.random() * frontierCount);
      const cellIndex = randomizeFrontier[frontierSlot];
      const neighborBase = cellIndex * maxNeighbors;
      const neighborCount = neighborCounts[cellIndex];
      const startOffset = Math.floor(Math.random() * Math.max(1, neighborCount));
      let grewCluster = false;

      for (let offset = 0; offset < neighborCount; offset++) {
        const neighborOffset = (startOffset + offset) % neighborCount;
        const neighborIndex = neighborIndexBuffer[neighborBase + neighborOffset];

        if (simulation.state[neighborIndex] === 1) {
          continue;
        }

        simulation.state[neighborIndex] = 1;
        randomizeFrontier[frontierCount] = neighborIndex;
        frontierCount += 1;
        aliveCount += 1;
        grewCluster = true;
        break;
      }

      if (!grewCluster) {
        frontierCount -= 1;
        randomizeFrontier[frontierSlot] = randomizeFrontier[frontierCount];
      }
    }

    simulation.generation = 0;
    simulation.aliveCount = aliveCount;
    updateStats();
  }

  function clearState() {
    simulation.prevState.fill(0);
    simulation.state.fill(0);
    simulation.nextState.fill(0);
    simulation.generation = 0;
    simulation.aliveCount = 0;
    updateStats();
  }

  const sceneSystem = ns.createSceneSystem(document.getElementById("canvas-container"));
  const renderSystem = ns.createRenderSystem({
    lattice,
    scene: sceneSystem.scene,
    getSimulation() {
      return simulation;
    }
  });

  ns.initializeUI({
    presets: ns.constants.lattice.PRESETS,
    allSlicesValue: renderConstants.allSlicesValue,
    randomizeRange,
    isBirthRuleEnabled(value) {
      return simulation.birthRuleMask[value] === 1;
    },
    isSurvivalRuleEnabled(value) {
      return simulation.survivalRuleMask[value] === 1;
    },
    toggleBirthRule(value) {
      simulation.birthRuleMask[value] = simulation.birthRuleMask[value] === 1 ? 0 : 1;
      return simulation.birthRuleMask[value] === 1;
    },
    toggleSurvivalRule(value) {
      simulation.survivalRuleMask[value] = simulation.survivalRuleMask[value] === 1 ? 0 : 1;
      return simulation.survivalRuleMask[value] === 1;
    },
    setRules(rules) {
      replaceRuleMask(simulation.birthRuleMask, rules.birthRule);
      replaceRuleMask(simulation.survivalRuleMask, rules.survivalRule);
    },
    onRandomize(cellCount) {
      randomize(cellCount);
      renderSystem.requestRefresh({ immediate: true });
    },
    onTogglePlay() {
      simulation.playing = !simulation.playing;
      if (!simulation.playing) {
        renderSystem.requestRefresh({ immediate: true });
      }
      return simulation.playing;
    },
    onStop() {
      simulation.playing = false;
      renderSystem.requestRefresh({ immediate: true });
    },
    onStep() {
      step();
      renderSystem.requestRefresh({ immediate: true });
    },
    onClear() {
      clearState();
      renderSystem.requestRefresh({ immediate: true });
    },
    onSpeedChange(value) {
      simulation.stepsPerSecond = value;
    },
    onSliceChange(value) {
      renderSystem.setSlice(value);
      renderSystem.requestRefresh({ immediate: true });
    },
    onOpacityChange(value) {
      renderSystem.setOpacity(value / 100);
    },
    onBlobRadiusChange(value) {
      renderSystem.setBlobRadius(value / 100);
      renderSystem.requestRefresh({ immediate: true });
    },
    onResolutionChange(value) {
      renderSystem.setResolution(value);
      renderSystem.requestRefresh({ immediate: true });
    },
    isSmoothShadingEnabled() {
      return renderSystem.isSmoothShadingEnabled();
    },
    onToggleSmoothShading() {
      return renderSystem.toggleSmoothShading();
    },
    onToggleBoundaries() {
      return renderSystem.toggleBoundaries();
    },
    onBoundaryAliveOpacityChange(value) {
      renderSystem.setBoundaryAliveOpacity(value / 100);
    },
    onBoundaryAdjacentOpacityChange(value) {
      renderSystem.setBoundaryAdjacentOpacity(value / 100);
    }
  });

  let lastFrameTime = 0;
  let stepAccumulator = 0;
  let fpsFrameCount = 0;
  let fpsWindowStart = performance.now();

  function updateFps(time) {
    fpsFrameCount += 1;
    const elapsed = time - fpsWindowStart;

    if (elapsed >= 500) {
      const fps = Math.round((fpsFrameCount * 1000) / elapsed);
      statElements.fps.textContent = String(fps);
      fpsFrameCount = 0;
      fpsWindowStart = time;
    }
  }

  function animate(time) {
    requestAnimationFrame(animate);

    const frameDelta = lastFrameTime === 0 ? 0 : Math.min(time - lastFrameTime, 250);
    lastFrameTime = time;

    if (simulation.playing) {
      // Simulation speed is frame-rate independent: we step based on elapsed
      // time instead of assuming requestAnimationFrame cadence.
      const interval = 1000 / simulation.stepsPerSecond;
      stepAccumulator += frameDelta;

      let stepsThisFrame = 0;
      while (stepAccumulator >= interval && stepsThisFrame < simulationConstants.maxStepsPerFrame) {
        step();
        renderSystem.requestRefresh();
        stepAccumulator -= interval;
        stepsThisFrame += 1;
      }

      if (stepsThisFrame === simulationConstants.maxStepsPerFrame) {
        const maxLag = interval * simulationConstants.maxAccumulatedStepLag;
        if (stepAccumulator > maxLag) {
          stepAccumulator = maxLag;
        }
      }
    } else {
      stepAccumulator = 0;
    }

    if (!sceneSystem.isDragging() && !simulation.playing) {
      // A slow idle rotation keeps the lattice readable when the simulation
      // is paused without fighting user input.
      sceneSystem.autoRotate();
    }

    renderSystem.renderFrame(time, simulation.playing);
    updateFps(time);
    sceneSystem.render();
  }

  statElements.grid.textContent = `${lattice.numCells} cells (FCC)`;

  randomize(randomizeRange.initial);
  renderSystem.requestRefresh({ immediate: true });
  animate(0);
})(window.RDLife);
