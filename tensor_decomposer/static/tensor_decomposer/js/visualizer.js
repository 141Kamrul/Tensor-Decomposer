import { 
    createEquationSVG, 
    getVisualizationItems, 
    createBarChartSVG, 
    createHeatmapSVG, 
    createComparisonBarChart 
} from './charts.js';

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
        if (item.type === "heatmap") {
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
    grid.className = "visual-grid";
    container.appendChild(grid);

    // 1. Relative error comparison
    const errorCard = createVisualCard("Relative Reconstruction Error (Lower is Better)");
    const errors = comparison.map(c => c.relative_error);
    const labels = comparison.map(c => c.algorithm.toUpperCase());
    errorCard.appendChild(createComparisonBarChart(labels, errors, "#8b5cf6"));
    grid.appendChild(errorCard);

    // 2. Compression ratio comparison
    const ratioCard = createVisualCard("Compression Ratio (Higher is Better)");
    const ratios = comparison.map(c => c.compression_ratio);
    ratioCard.appendChild(createComparisonBarChart(labels, ratios, "#06b6d4"));
    grid.appendChild(ratioCard);

    // 3. Execution time comparison
    const timeCard = createVisualCard("Execution Time (ms) (Lower is Better)");
    const times = comparison.map(c => c.execution_time_ms);
    timeCard.appendChild(createComparisonBarChart(labels, times, "#ec4899"));
    grid.appendChild(timeCard);
}
