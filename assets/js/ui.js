window.RDLife = window.RDLife || {};

(function registerUi(ns) {
  const maxNeighbors = ns.constants.lattice.MAX_NEIGHBORS;

  ns.initializeUI = function initializeUI(options) {
    // Cache the frequently touched DOM nodes once so the rest of the UI
    // logic can stay focused on behavior.
    const elements = {
      play: document.getElementById("btn-play"),
      step: document.getElementById("btn-step"),
      clear: document.getElementById("btn-clear"),
      speed: document.getElementById("speed"),
      speedSlider: document.getElementById("speed-slider"),
      speedVal: document.getElementById("speed-val"),
      count: document.getElementById("count"),
      countSlider: document.getElementById("count-slider"),
      countVal: document.getElementById("count-val"),
      slice: document.getElementById("slice-slider"),
      sliceVal: document.getElementById("slice-val"),
      opacity: document.getElementById("opacity-slider"),
      opacityVal: document.getElementById("opacity-val"),
      blobRadius: document.getElementById("blob-radius-slider"),
      blobRadiusVal: document.getElementById("blob-radius-val"),
      gridResolution: document.getElementById("grid-res-slider"),
      gridResolutionVal: document.getElementById("grid-res-val"),
      smoothShading: document.getElementById("btn-smooth-shading"),
      boundaries: document.getElementById("btn-boundaries"),
      boundaryAlive: document.getElementById("boundary-alive-slider"),
      boundaryAliveVal: document.getElementById("boundary-alive-val"),
      boundaryAdjacent: document.getElementById("boundary-adj-slider"),
      boundaryAdjacentVal: document.getElementById("boundary-adj-val"),
      ruleGraph: document.getElementById("rule-graph"),
      birthRules: document.getElementById("birth-rules"),
      survivalRules: document.getElementById("survival-rules"),
      presets: document.getElementById("presets-row")
    };

    function syncPlayButton(playing) {
      elements.play.textContent = playing ? "⏸ Pause" : "▶ Play";
      elements.play.classList.toggle("active", playing);

      elements.step.disabled = playing

      elements.count.classList.toggle("hidden", playing);
      elements.speed.classList.toggle("hidden", !playing);
    }

    function syncSmoothShadingButton(enabled) {
      elements.smoothShading.checked = enabled;
    }

    function renderRuleGraph() {
      if (!elements.ruleGraph) {
        return;
      }

      const width = 420;
      const height = 132;
      const padding = { top: 14, right: 14, bottom: 28, left: 26 };
      const plotWidth = width - padding.left - padding.right;
      const plotHeight = height - padding.top - padding.bottom;
      const step = plotWidth / maxNeighbors;
      const topY = padding.top;
      const middleY = padding.top + plotHeight / 2;
      const bottomY = padding.top + plotHeight;
      const yByValue = {
        1: topY,
        0: middleY,
        "-1": bottomY
      };

      function xFor(index) {
        return padding.left + step * index;
      }

      function buildPoints(valueForIndex) {
        return Array.from({ length: maxNeighbors + 1 }, function createPoint(_, index) {
          return `${xFor(index).toFixed(2)},${yByValue[valueForIndex(index)].toFixed(2)}`;
        }).join(" ");
      }

      const birthValueForIndex = function birthValueForIndex(index) {
        return options.isBirthRuleEnabled(index) ? 1 : 0;
      };

      const survivalValueForIndex = function survivalValueForIndex(index) {
        return options.isSurvivalRuleEnabled(index) ? 0 : -1;
      };

      const xLabels = Array.from({ length: maxNeighbors + 1 }, function createLabel(_, index) {
        return `<text class="axis-text" x="${xFor(index).toFixed(2)}" y="${height - 10}" text-anchor="middle">${index}</text>`;
      }).join("");

      elements.ruleGraph.innerHTML = `
        <line class="guide" x1="${padding.left}" y1="${topY}" x2="${width - padding.right}" y2="${topY}"></line>
        <line class="guide zero" x1="${padding.left}" y1="${middleY}" x2="${width - padding.right}" y2="${middleY}"></line>
        <line class="guide" x1="${padding.left}" y1="${bottomY}" x2="${width - padding.right}" y2="${bottomY}"></line>
        <text class="axis-text" x="${padding.left - 9}" y="${topY + 3}" text-anchor="end">+</text>
        <text class="axis-text" x="${padding.left - 9}" y="${middleY + 3}" text-anchor="end">0</text>
        <text class="axis-text" x="${padding.left - 9}" y="${bottomY + 3}" text-anchor="end">-</text>
        <polyline class="line birth" points="${buildPoints(birthValueForIndex)}"></polyline>
        <polyline class="line survive" points="${buildPoints(survivalValueForIndex)}"></polyline>
        ${xLabels}
      `;
    }

    function buildRuleChips() {
      elements.birthRules.innerHTML = "";
      elements.survivalRules.innerHTML = "";

      // The chips toggle the compact rule masks owned by main.js, so rule
      // changes are immediately visible to the next simulation step.
      const birthLabel = document.createElement("div");
      birthLabel.className = "rule-label birth";
      birthLabel.textContent = "Birth";
      elements.birthRules.appendChild(birthLabel);
      for (let n = 0; n <= maxNeighbors; n++) {
        const chip = document.createElement("div");
        chip.className = "rule-chip" + (options.isBirthRuleEnabled(n) ? " on" : "");
        chip.textContent = n;
        chip.onclick = function onBirthRuleToggle() {
          chip.classList.toggle("on", options.toggleBirthRule(n));
          renderRuleGraph();
        };
        elements.birthRules.appendChild(chip);
      }

      const surviveLabel = document.createElement("div");
      surviveLabel.className = "rule-label survive";
      surviveLabel.textContent = "Survive";
      elements.survivalRules.appendChild(surviveLabel);
      for (let n = 0; n <= maxNeighbors; n++) {
        const chip = document.createElement("div");
        chip.className = "rule-chip" + (options.isSurvivalRuleEnabled(n) ? " on" : "");
        chip.textContent = n;
        chip.onclick = function onSurvivalRuleToggle() {
          chip.classList.toggle("on", options.toggleSurvivalRule(n));
          renderRuleGraph();
        };
        elements.survivalRules.appendChild(chip);
      }

      renderRuleGraph();
    }

    function setCountValue(value) {
      elements.countSlider.value = value;
      elements.countVal.textContent = String(value);
    }

    let suppressNextCountChange = false;

    function commitCountChange() {
      options.onRandomize(parseInt(elements.countSlider.value, 10));
    }

    function setActivePreset(activeButton) {
      const presetButtons = elements.presets.querySelectorAll(".preset-btn");
      presetButtons.forEach(function togglePreset(button) {
        button.classList.toggle("active", button === activeButton);
      });
    }

    function buildPresets() {
      elements.presets.innerHTML = "";

      options.presets.forEach(function createPresetButton(preset) {
        const button = document.createElement("button");
        button.className = "preset-btn";
        button.textContent = preset.name;
        button.onclick = function onPresetClick() {
          // Presets replace both rule sets and the seed count together so
          // the rendered result matches the intended preset behavior.
          options.setRules({
            birthRule: preset.birth,
            survivalRule: preset.survival
          });
          setCountValue(preset.initCount);
          buildRuleChips();
          setActivePreset(button);
          options.onRandomize(preset.initCount);
        };
        elements.presets.appendChild(button);
      });
    }

    elements.countSlider.min = String(options.randomizeRange.min);
    elements.countSlider.max = String(options.randomizeRange.max);
    setCountValue(options.randomizeRange.initial);

    buildRuleChips();
    buildPresets();
    syncPlayButton(false);
    syncSmoothShadingButton(options.isSmoothShadingEnabled());

    // Everything below is thin event wiring: UI translates user input into
    // high-level callbacks, while main.js remains the single owner of state.
    elements.play.onclick = function onPlayClick() {
      syncPlayButton(options.onTogglePlay());
    };

    elements.step.onclick = function onStepClick() {
      options.onStep();
    };

    elements.clear.onclick = function onClearClick() {
      options.onStop();
      syncPlayButton(false);
      commitCountChange();
    };

    elements.speedSlider.oninput = function onSpeedInput() {
      const value = parseInt(this.value, 10);
      elements.speedVal.textContent = `${value} it/s`;
      options.onSpeedChange(value);
    };

    elements.countSlider.oninput = function onCountInput() {
      elements.countVal.textContent = String(this.value);
    };

    // Commit the new random seed when the user releases the slider thumb.
    elements.countSlider.addEventListener("pointerup", function onCountPointerUp() {
      suppressNextCountChange = true;
      commitCountChange();
    });

    elements.countSlider.addEventListener("change", function onCountChange() {
      if (suppressNextCountChange) {
        suppressNextCountChange = false;
        return;
      }

      commitCountChange();
    });

    elements.slice.oninput = function onSliceInput() {
      const value = parseInt(this.value, 10);
      elements.sliceVal.textContent = value === options.allSlicesValue ? "All" : String(value);
      options.onSliceChange(value);
    };

    elements.opacity.oninput = function onOpacityInput() {
      const value = parseInt(this.value, 10);
      elements.opacityVal.textContent = `${value}%`;
      options.onOpacityChange(value);
    };

    elements.blobRadius.oninput = function onRadiusInput() {
      const value = parseInt(this.value, 10);
      elements.blobRadiusVal.textContent = `${value}%`;
      options.onBlobRadiusChange(value);
    };

    elements.gridResolution.oninput = function onResolutionInput() {
      const value = parseInt(this.value, 10);
      elements.gridResolutionVal.textContent = String(value);
      options.onResolutionChange(value);
    };

    elements.smoothShading.onchange = function onSmoothShadingChange() {
      this.checked = options.onToggleSmoothShading();
    };

    elements.boundaries.onchange = function onBoundariesChange() {
      this.checked = options.onToggleBoundaries();
    };

    elements.boundaryAlive.oninput = function onBoundaryAliveInput() {
      const value = parseInt(this.value, 10);
      elements.boundaryAliveVal.textContent = `${value}%`;
      options.onBoundaryAliveOpacityChange(value);
    };

    elements.boundaryAdjacent.oninput = function onBoundaryAdjacentInput() {
      const value = parseInt(this.value, 10);
      elements.boundaryAdjacentVal.textContent = `${value}%`;
      options.onBoundaryAdjacentOpacityChange(value);
    };

    return {
      rebuildRules: buildRuleChips
    };
  };
})(window.RDLife);
