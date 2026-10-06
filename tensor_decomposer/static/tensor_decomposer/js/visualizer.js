import { 
    createEquationSVG, 
    getVisualizationItems, 
    createBarChartSVG, 
    createHeatmapSVG, 
    createComparisonBarChart 
} from './charts.js';

import { extract2DSlice, getTensorShape } from './helpers.js';

export function createVisualCard(title, subtitle) {
    const card = document.createElement("div");
    card.className = "visual-card";
    
    const h4 = document.createElement("h4");
    h4.className = "visual-card-title";
    h4.textContent = title;
    card.appendChild(h4);

    if (subtitle) {
        const p = document.createElement("p");
        p.className = "visual-card-subtitle";
        p.textContent = subtitle;
        p.style.fontSize = "0.75rem";
        p.style.color = "var(--text-muted)";
        p.style.marginTop = "0.25rem";
        p.style.textAlign = "center";
        card.appendChild(p);
    }
    
    return card;
}

export function renderVisualizations(algorithm, result, inputTensor) {
    const container = document.getElementById("visualization-container");
    const panelVisualization = document.getElementById("panel-visualization");
    if (!container || !panelVisualization) return;

    container.innerHTML = "";
    panelVisualization.classList.remove("hidden");

    const header = document.createElement("h3");
    header.className = "visual-title";
    header.textContent = `Visualizing: ${algorithm.toUpperCase()}`;
    container.appendChild(header);

    // Render Equation Card first (full-width, outside grid)!
    const eqCard = createVisualCard("Decomposition Equation Structure", "Scaled ratio-wise based on input tensor and decomposed factors");
    eqCard.style.marginBottom = "1.5rem";
    eqCard.appendChild(createEquationSVG(algorithm, result, inputTensor));
    container.appendChild(eqCard);

    // Get all visualization items (original tensor + outputs)
    const items = getVisualizationItems(algorithm, result, inputTensor);

    // Find global maximum dimension among all heatmaps to establish the scale ratio
    let globalMax = 1;
    items.forEach(item => {
        if (item.type === "heatmap" || item.type === "heatmap3d") {
            globalMax = Math.max(globalMax, item.rows, item.cols);
        }
    });

    // Grid for charts
    const grid = document.createElement("div");
    grid.className = "visual-grid";
    container.appendChild(grid);

    items.forEach(item => {
        if (item.type === "bar") {
            const card = createVisualCard(item.label);
            card.appendChild(createBarChartSVG(item.data));
            grid.appendChild(card);
        } else if (item.type === "heatmap") {
            const isTruncated = item.rows > 12 || item.cols > 12;
            const subtitle = isTruncated ? `Showing top 12x12 slice of actual ${item.rows}x${item.cols} matrix` : `Shape: ${item.rows}x${item.cols}`;
            const card = createVisualCard(item.label, subtitle);
            card.appendChild(createHeatmapSVG(item.data, item.rows, item.cols, globalMax));
            grid.appendChild(card);
        } else if (item.type === "heatmap3d") {
            const raw = item.rawTensor;
            const shape = item.shape || getTensorShape(raw);
            const numModes = shape.length;
            
            const card = createVisualCard(item.label, `Interactive 3D Slice Viewer (Shape: ${shape.join("×")})`);
            
            const controlsBar = document.createElement("div");
            controlsBar.className = "slice-control-bar";
            
            const modeSelect = document.createElement("select");
            modeSelect.className = "slice-mode-select";
            for (let m = 0; m < numModes; m++) {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = `Mode ${m} (Dim ${shape[m]})`;
                modeSelect.appendChild(opt);
            }
            controlsBar.appendChild(modeSelect);
            
            const slider = document.createElement("input");
            slider.type = "range";
            slider.className = "slice-range-slider";
            slider.min = "0";
            slider.max = String(Math.max(0, shape[0] - 1));
            slider.value = "0";
            controlsBar.appendChild(slider);
            
            const badge = document.createElement("span");
            badge.className = "slice-badge font-mono";
            badge.textContent = `Slice 1 / ${shape[0]}`;
            controlsBar.appendChild(badge);
            
            card.appendChild(controlsBar);
            
            const subTitleEl = card.querySelector(".visual-card-subtitle");

            const heatmapWrapper = document.createElement("div");
            heatmapWrapper.className = "heatmap-3d-wrapper";
            card.appendChild(heatmapWrapper);

            function updateSlice() {
                const axis = parseInt(modeSelect.value, 10);
                const maxIndex = Math.max(0, shape[axis] - 1);
                
                slider.max = String(maxIndex);
                if (parseInt(slider.value, 10) > maxIndex) {
                    slider.value = String(maxIndex);
                }
                const idx = parseInt(slider.value, 10);
                
                badge.textContent = `Slice ${idx + 1} / ${shape[axis]}`;
                
                const slice2D = extract2DSlice(raw, axis, idx);
                const sliceShape = getTensorShape(slice2D);
                const sRows = sliceShape[0] || 1;
                const sCols = sliceShape[1] || 1;

                if (subTitleEl) {
                    const isTrunc = sRows > 12 || sCols > 12;
                    subTitleEl.textContent = `Mode ${axis} Slice [${idx + 1}/${shape[axis]}] — Shape: ${sRows}×${sCols}` + (isTrunc ? " (showing top 12×12)" : "");
                }

                heatmapWrapper.innerHTML = "";
                heatmapWrapper.appendChild(createHeatmapSVG(slice2D, sRows, sCols, globalMax));
            }

            modeSelect.addEventListener("change", () => {
                slider.value = "0";
                updateSlice();
            });
            slider.addEventListener("input", updateSlice);

            updateSlice();

            grid.appendChild(card);
        }
    });
}

export function renderBenchmarkChart(benchmark) {
    const container = document.getElementById("benchmark-visualization-container");
    if (!container) return;
    container.innerHTML = "";
    container.style.display = "block";

    const header = document.createElement("h3");
    header.className = "visual-title";
    header.textContent = `Performance Metrics: ${benchmark.algorithm.toUpperCase()}`;
    container.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "visual-grid single";
    container.appendChild(grid);

    const card = createVisualCard("Execution Metrics");
    
    const wrapper = document.createElement("div");
    wrapper.className = "benchmark-bars";
    
    // Single Execution Time
    const rowTime = document.createElement("div");
    rowTime.className = "benchmark-bar-row";
    rowTime.innerHTML = `
        <div class="benchmark-bar-label">Execution Time</div>
        <div class="benchmark-bar-track">
            <div class="benchmark-bar-fill" style="width: 100%; background-color: #6366f1"></div>
        </div>
        <div class="benchmark-bar-val font-mono">${benchmark.execution_time_ms} ms</div>
    `;
    wrapper.appendChild(rowTime);

    // Computational FLOPs
    const rowFlops = document.createElement("div");
    rowFlops.className = "benchmark-bar-row";
    rowFlops.style.marginTop = "0.75rem";
    rowFlops.innerHTML = `
        <div class="benchmark-bar-label">Computational FLOPs</div>
        <div class="benchmark-bar-track">
            <div class="benchmark-bar-fill" style="width: 100%; background-color: #10b981"></div>
        </div>
        <div class="benchmark-bar-val font-mono">${benchmark.flops_str}</div>
    `;
    wrapper.appendChild(rowFlops);

    card.appendChild(wrapper);
    grid.appendChild(card);
}

export function renderComparisonCharts(comparison) {
    const container = document.getElementById("comparison-visualization-container");
    if (!container) return;
    container.innerHTML = "";
    container.style.display = "block";

    const header = document.createElement("h3");
    header.className = "visual-title";
    header.textContent = "Method Comparison Visualizations";
    container.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "visual-grid comparison-grid";
    container.appendChild(grid);

    const labels = comparison.map(c => c.algorithm);

    // 1. Relative error comparison
    const errorCard = createVisualCard("Relative Reconstruction Error (Lower is Better)");
    const errors = comparison.map(c => c.relative_error);
    errorCard.appendChild(createComparisonBarChart(labels, errors, "#8b5cf6", "error"));
    grid.appendChild(errorCard);

    // 2. Compression ratio comparison
    const ratioCard = createVisualCard("Compression Ratio (Higher is Better)");
    const ratios = comparison.map(c => c.compression_ratio);
    ratioCard.appendChild(createComparisonBarChart(labels, ratios, "#06b6d4", "ratio"));
    grid.appendChild(ratioCard);

    const timeCard = createVisualCard("Execution Time (ms) (Lower is Better)");
    const times = comparison.map(c => c.execution_time_ms);
    timeCard.appendChild(createComparisonBarChart(labels, times, "#ec4899", "time"));
    grid.appendChild(timeCard);
}

export function renderReconstructionViewer(originalTensor, reconstructedTensor, analysis, algorithm = "cp") {
    const container = document.getElementById("reconstruction-viewer-container");
    if (!container) return;
    container.innerHTML = "";

    const recon = reconstructedTensor || (analysis && analysis.reconstructed_tensor);
    const orig = originalTensor;

    if (!orig || !recon) {
        container.style.display = "none";
        return;
    }

    container.style.display = "block";

    const origShape = getTensorShape(orig);
    const reconShape = getTensorShape(recon);
    const numModes = origShape.length;
    const isMultiDimensional = numModes >= 3;

    // Title matching visualize
    const header = document.createElement("h3");
    header.className = "visual-title";
    header.textContent = `Reconstruction: ${algorithm.toUpperCase()}`;
    container.appendChild(header);

    let currentMode = 0;
    let currentSlice = 0;

    let modeSelect = null;
    let slider = null;
    let badge = null;

    // Interactive synchronized slice slider for 3D/higher-order tensors
    if (isMultiDimensional) {
        const controlsBar = document.createElement("div");
        controlsBar.className = "slice-control-bar";
        controlsBar.style.maxWidth = "460px";
        controlsBar.style.margin = "0 auto 1.25rem auto";

        modeSelect = document.createElement("select");
        modeSelect.className = "slice-mode-select font-mono";
        for (let m = 0; m < numModes; m++) {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = `Mode ${m} (Dim ${origShape[m]})`;
            modeSelect.appendChild(opt);
        }
        controlsBar.appendChild(modeSelect);

        slider = document.createElement("input");
        slider.type = "range";
        slider.className = "slice-range-slider";
        slider.min = "0";
        slider.max = String(Math.max(0, origShape[0] - 1));
        slider.value = "0";
        controlsBar.appendChild(slider);

        badge = document.createElement("span");
        badge.className = "slice-badge font-mono";
        badge.textContent = `Slice 1 / ${origShape[0]}`;
        controlsBar.appendChild(badge);

        container.appendChild(controlsBar);
    }

    // Side-by-side grid identical to visualize
    const grid = document.createElement("div");
    grid.className = "visual-grid";
    grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(240px, 1fr))";
    grid.style.maxWidth = "660px";
    grid.style.margin = "0 auto";
    container.appendChild(grid);

    // 1. Original Tensor Card
    const origCard = createVisualCard("Original Tensor (X)", `Shape: ${origShape.join("×")}`);
    const origHeatmapWrapper = document.createElement("div");
    origHeatmapWrapper.className = "heatmap-3d-wrapper";
    origCard.appendChild(origHeatmapWrapper);
    grid.appendChild(origCard);

    // 2. Reconstructed Tensor Card
    const reconCard = createVisualCard("Reconstructed Tensor (X̂)", `Shape: ${reconShape.join("×")}`);
    const reconHeatmapWrapper = document.createElement("div");
    reconHeatmapWrapper.className = "heatmap-3d-wrapper";
    reconCard.appendChild(reconHeatmapWrapper);
    grid.appendChild(reconCard);

    const origSubtitleEl = origCard.querySelector(".visual-card-subtitle");
    const reconSubtitleEl = reconCard.querySelector(".visual-card-subtitle");

    function updateSlice() {
        if (isMultiDimensional) {
            currentMode = parseInt(modeSelect.value, 10);
            const maxIndex = Math.max(0, origShape[currentMode] - 1);
            slider.max = String(maxIndex);
            if (parseInt(slider.value, 10) > maxIndex) {
                slider.value = String(maxIndex);
            }
            currentSlice = parseInt(slider.value, 10);
            badge.textContent = `Slice ${currentSlice + 1} / ${origShape[currentMode]}`;
        }

        const origSlice = extract2DSlice(orig, currentMode, currentSlice);
        const reconSlice = extract2DSlice(recon, currentMode, currentSlice);

        const origSliceShape = getTensorShape(origSlice);
        const oRows = origSliceShape[0] || (Array.isArray(origSlice) ? origSlice.length : 1);
        const oCols = origSliceShape[1] || (Array.isArray(origSlice) && Array.isArray(origSlice[0]) ? origSlice[0].length : 1);

        const reconSliceShape = getTensorShape(reconSlice);
        const rRows = reconSliceShape[0] || (Array.isArray(reconSlice) ? reconSlice.length : 1);
        const rCols = reconSliceShape[1] || (Array.isArray(reconSlice) && Array.isArray(reconSlice[0]) ? reconSlice[0].length : 1);

        const globalMax = Math.max(oRows, oCols, rRows, rCols, 1);

        if (origSubtitleEl) {
            const isTrunc = oRows > 12 || oCols > 12;
            origSubtitleEl.textContent = isMultiDimensional 
                ? `Mode ${currentMode} Slice [${currentSlice + 1}/${origShape[currentMode]}] — Shape: ${oRows}×${oCols}${isTrunc ? " (top 12×12)" : ""}`
                : `Shape: ${oRows}×${oCols}${isTrunc ? " (top 12×12)" : ""}`;
        }

        if (reconSubtitleEl) {
            const isTrunc = rRows > 12 || rCols > 12;
            reconSubtitleEl.textContent = isMultiDimensional
                ? `Mode ${currentMode} Slice [${currentSlice + 1}/${origShape[currentMode]}] — Shape: ${rRows}×${rCols}${isTrunc ? " (top 12×12)" : ""}`
                : `Shape: ${rRows}×${rCols}${isTrunc ? " (top 12×12)" : ""}`;
        }

        origHeatmapWrapper.innerHTML = "";
        origHeatmapWrapper.appendChild(createHeatmapSVG(origSlice, oRows, oCols, globalMax));

        reconHeatmapWrapper.innerHTML = "";
        reconHeatmapWrapper.appendChild(createHeatmapSVG(reconSlice, rRows, rCols, globalMax));
    }

    if (isMultiDimensional) {
        modeSelect.addEventListener("change", () => {
            slider.value = "0";
            updateSlice();
        });
        slider.addEventListener("input", updateSlice);
    }

    updateSlice();
}

