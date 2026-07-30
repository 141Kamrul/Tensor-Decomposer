document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".tensor-form");
    const resultsColumn = document.querySelector(".results-column");
    
    // Panel elements
    const panelError = document.getElementById("panel-error");
    const panelDecomposition = document.getElementById("panel-decomposition");
    const panelAnalysis = document.getElementById("panel-analysis");
    const panelBenchmark = document.getElementById("panel-benchmark");
    const panelComparison = document.getElementById("panel-comparison");
    const panelVisualization = document.getElementById("panel-visualization");
    
    // Create loading skeleton overlay
    const loader = document.createElement("div");
    loader.className = "loader-overlay";
    loader.innerHTML = `
        <div class="loader-content">
            <div class="spinner"></div>
            <p>Processing tensor decomposition...</p>
        </div>
    `;
    document.body.appendChild(loader);

    // Form submission via AJAX
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Identify which action was clicked
        const submitter = e.submitter;
        if (!submitter) return;
        
        const action = submitter.value;
        const formData = new FormData(form);
        formData.append("action", action);
        
        // Simple client-side validation
        const tensorInput = document.getElementById("tensor_input").value.trim();
        const tensorFile = document.getElementById("tensor_file").files[0];
        
        if (!tensorInput && !tensorFile) {
            showError("Please enter a tensor manually or upload a tensor file.");
            return;
        }

        // Show loading state
        loader.classList.add("active");
        hideAllPanels();

        try {
            const response = await fetch("", {
                method: "POST",
                body: formData,
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "An error occurred during decomposition.");
            }

            // Update UI based on action
            handleSuccess(action, data);
        } catch (err) {
            showError(err.message);
        } finally {
            loader.classList.remove("active");
        }
    });

    function hideAllPanels() {
        panelError.classList.add("hidden");
        panelDecomposition.classList.add("hidden");
        panelAnalysis.classList.add("hidden");
        panelBenchmark.classList.add("hidden");
        panelComparison.classList.add("hidden");
        panelVisualization.classList.add("hidden");
    }

    function showError(message) {
        hideAllPanels();
        const errorMessage = panelError.querySelector(".error-message");
        errorMessage.textContent = message;
        panelError.classList.remove("hidden");
        panelError.scrollIntoView({ behavior: "smooth" });
    }

    function handleSuccess(action, data) {
        // Clear any previous error
        panelError.classList.add("hidden");

        // 1. Handle Decomposition / Analysis actions
        if (action === "decompose" || action === "analyze") {
            if (data.result) {
                const pre = panelDecomposition.querySelector("pre");
                const dl = panelDecomposition.querySelector(".download-btn");
                pre.textContent = formatResultMatrixStyle(data.result);
                if (dl && data.download_url) {
                    dl.href = `/download/${data.download_url}/`;
                    dl.classList.remove("hidden");
                }
                panelDecomposition.classList.remove("hidden");
            }

            if (data.analysis) {
                // Update analysis metrics
                document.getElementById("metric-compression").textContent = data.analysis.compression_ratio;
                document.getElementById("metric-abs-error").textContent = data.analysis.absolute_error;
                document.getElementById("metric-rel-error").textContent = data.analysis.relative_error;
                document.getElementById("metric-params").textContent = `${data.analysis.compressed_parameters} / ${data.analysis.original_parameters}`;
                
                panelAnalysis.querySelector("pre").textContent = formatAnalysisStyle(data.analysis);
                panelAnalysis.classList.remove("hidden");
            }
            
            // Build visual representations
            if (data.result) {
                renderVisualizations(data.algorithm, data.result);
            }
        } 
        
        // 2. Handle Benchmarking action
        else if (action === "benchmark") {
            if (data.benchmark) {
                document.getElementById("metric-avg-time").textContent = `${data.benchmark.average_ms} ms`;
                document.getElementById("metric-min-time").textContent = `${data.benchmark.min_ms} ms`;
                document.getElementById("metric-max-time").textContent = `${data.benchmark.max_ms} ms`;
                document.getElementById("metric-runs").textContent = data.benchmark.repeats;
                
                panelBenchmark.querySelector("pre").textContent = formatSimpleJSON(data.benchmark);
                panelBenchmark.classList.remove("hidden");
                
                // Visualize benchmarks
                renderBenchmarkChart(data.benchmark);
            }
        } 
        
        // 3. Handle Comparison action
        else if (action === "compare") {
            if (data.comparison) {
                const tbody = panelComparison.querySelector("tbody");
                tbody.innerHTML = "";
                
                data.comparison.forEach(row => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td class="font-semibold text-cyan-400">${row.algorithm.toUpperCase()}</td>
                        <td><span class="badge badge-teal">${row.compression_ratio}x</span></td>
                        <td><span class="badge badge-purple">${row.relative_error}</span></td>
                        <td class="font-mono text-gray-300">${row.compressed_parameters}</td>
                    `;
                    tbody.appendChild(tr);
                });
                
                panelComparison.querySelector("pre").textContent = formatSimpleJSON(data.comparison);
                panelComparison.classList.remove("hidden");
                
                // Visualize comparison
                renderComparisonCharts(data.comparison);
            }
        }
        
        // Scroll to results
        resultsColumn.scrollIntoView({ behavior: "smooth" });
    }

    // --- Visualization Engine ---
    
    function renderVisualizations(algorithm, result) {
        const container = document.getElementById("visualization-container");
        container.innerHTML = "";
        panelVisualization.classList.remove("hidden");

        const header = document.createElement("h3");
        header.className = "visual-title";
        header.textContent = `Visualizing: ${algorithm.toUpperCase()}`;
        container.appendChild(header);

        // Grid for charts
        const grid = document.createElement("div");
        grid.className = "visual-grid";
        container.appendChild(grid);

        // Case 1: Singular Values or Eigenvalues (1D spectrum array)
        if (result.singular_values || result.eigenvalues) {
            const vals = result.singular_values || result.eigenvalues;
            const card = createVisualCard("Spectrum Decay (Singular/Eigenvalues)");
            card.appendChild(createBarChartSVG(vals));
            grid.appendChild(card);
        }

        // Case 2: Factors (CP, Tucker, HOSVD) - Array of 2D factor matrices
        if (result.factors && Array.isArray(result.factors)) {
            result.factors.forEach((factor, idx) => {
                const card = createVisualCard(`Factor Matrix - Mode ${idx + 1}`);
                card.appendChild(createHeatmapSVG(factor));
                grid.appendChild(card);
            });
        }

        // Case 3: Core Tensors (Tucker/HOSVD core or TT cores)
        if (result.core) {
            // Tucker Core (often 3D or high dimensional)
            const core = result.core;
            if (Array.isArray(core)) {
                // If it is 2D, render directly
                if (core.length > 0 && !Array.isArray(core[0][0])) {
                    const card = createVisualCard("Core Tensor (2D Slice)");
                    card.appendChild(createHeatmapSVG(core));
                    grid.appendChild(card);
                } else {
                    // It is 3D+, render first slice [0, :, :]
                    const slice = core[0];
                    const card = createVisualCard("Core Tensor (Mode-1 First Slice)");
                    card.appendChild(createHeatmapSVG(slice));
                    grid.appendChild(card);
                }
            }
        }

        // Case 4: Matrix outputs (U, Vh, Q, R, L, U)
        const matrices = ["u", "vh", "q", "r", "l"];
        matrices.forEach(key => {
            if (result[key] && Array.isArray(result[key])) {
                const card = createVisualCard(`Matrix: ${key.toUpperCase()}`);
                card.appendChild(createHeatmapSVG(result[key]));
                grid.appendChild(card);
            }
        });
    }

    function renderBenchmarkChart(benchmark) {
        const container = document.getElementById("visualization-container");
        container.innerHTML = "";
        panelVisualization.classList.remove("hidden");

        const header = document.createElement("h3");
        header.className = "visual-title";
        header.textContent = `Performance Metrics: ${benchmark.algorithm.toUpperCase()}`;
        container.appendChild(header);

        const grid = document.createElement("div");
        grid.className = "visual-grid single";
        container.appendChild(grid);

        const card = createVisualCard("Execution Times (ms)");
        
        // Simple horizontal bar chart for benchmarking min/avg/max
        const wrapper = document.createElement("div");
        wrapper.className = "benchmark-bars";
        
        const metrics = [
            { label: "Min Duration", value: benchmark.min_ms, color: "#10b981" },
            { label: "Avg Duration", value: benchmark.average_ms, color: "#6366f1" },
            { label: "Max Duration", value: benchmark.max_ms, color: "#f43f5e" }
        ];

        const maxVal = Math.max(...metrics.map(m => m.value)) || 1;

        metrics.forEach(m => {
            const row = document.createElement("div");
            row.className = "benchmark-bar-row";
            const percent = (m.value / maxVal) * 100;
            
            row.innerHTML = `
                <div class="benchmark-bar-label">${m.label}</div>
                <div class="benchmark-bar-track">
                    <div class="benchmark-bar-fill" style="width: ${percent}%; background-color: ${m.color}"></div>
                </div>
                <div class="benchmark-bar-val font-mono">${m.value} ms</div>
            `;
            wrapper.appendChild(row);
        });

        card.appendChild(wrapper);
        grid.appendChild(card);
    }

    function renderComparisonCharts(comparison) {
        const container = document.getElementById("visualization-container");
        container.innerHTML = "";
        panelVisualization.classList.remove("hidden");

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
    }

    function createVisualCard(title) {
        const card = document.createElement("div");
        card.className = "visual-card";
        
        const h4 = document.createElement("h4");
        h4.className = "visual-card-title";
        h4.textContent = title;
        card.appendChild(h4);
        
        return card;
    }

    // --- SVG Chart Creators ---

    function createBarChartSVG(data) {
        const svgns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgns, "svg");
        svg.setAttribute("viewBox", "0 0 400 200");
        svg.className = "visual-svg";

        const margin = { top: 20, right: 20, bottom: 30, left: 40 };
        const width = 400 - margin.left - margin.right;
        const height = 200 - margin.top - margin.bottom;

        const maxVal = Math.max(...data) || 1;
        const barWidth = width / data.length;

        // Grid lines
        for (let i = 0; i <= 4; i++) {
            const y = margin.top + (height / 4) * i;
            const line = document.createElementNS(svgns, "line");
            line.setAttribute("x1", margin.left);
            line.setAttribute("y1", y);
            line.setAttribute("x2", margin.left + width);
            line.setAttribute("y2", y);
            line.setAttribute("stroke", "rgba(255, 255, 255, 0.08)");
            line.setAttribute("stroke-dasharray", "4");
            svg.appendChild(line);

            // Labels
            const text = document.createElementNS(svgns, "text");
            text.setAttribute("x", margin.left - 8);
            text.setAttribute("y", y + 4);
            text.setAttribute("text-anchor", "end");
            text.setAttribute("fill", "#9ca3af");
            text.setAttribute("font-size", "10");
            text.setAttribute("font-family", "monospace");
            text.textContent = ((maxVal * (4 - i)) / 4).toFixed(2);
            svg.appendChild(text);
        }

        // Draw bars
        data.forEach((val, i) => {
            const h = (val / maxVal) * height;
            const x = margin.left + i * barWidth + 2;
            const y = margin.top + height - h;
            const w = Math.max(1, barWidth - 4);

            const rect = document.createElementNS(svgns, "rect");
            rect.setAttribute("x", x);
            rect.setAttribute("y", y);
            rect.setAttribute("width", w);
            rect.setAttribute("height", h);
            rect.setAttribute("fill", "url(#bar-gradient)");
            rect.setAttribute("rx", "3");

            // Add simple tooltip value
            const title = document.createElementNS(svgns, "title");
            title.textContent = `Index ${i}: ${val.toFixed(5)}`;
            rect.appendChild(title);

            svg.appendChild(rect);
        });

        // Gradient definition
        const defs = document.createElementNS(svgns, "defs");
        const grad = document.createElementNS(svgns, "linearGradient");
        grad.setAttribute("id", "bar-gradient");
        grad.setAttribute("x1", "0");
        grad.setAttribute("y1", "0");
        grad.setAttribute("x2", "0");
        grad.setAttribute("y2", "1");
        
        const stop1 = document.createElementNS(svgns, "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", "#06b6d4");
        
        const stop2 = document.createElementNS(svgns, "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", "#6366f1");
        
        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
        svg.appendChild(defs);

        return svg;
    }

    function createComparisonBarChart(labels, values, color) {
        const svgns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgns, "svg");
        svg.setAttribute("viewBox", "0 0 400 200");
        svg.className = "visual-svg";

        const margin = { top: 20, right: 20, bottom: 40, left: 45 };
        const width = 400 - margin.left - margin.right;
        const height = 200 - margin.top - margin.bottom;

        const maxVal = Math.max(...values) || 1;
        const barWidth = width / values.length;

        // Grid lines
        for (let i = 0; i <= 4; i++) {
            const y = margin.top + (height / 4) * i;
            const line = document.createElementNS(svgns, "line");
            line.setAttribute("x1", margin.left);
            line.setAttribute("y1", y);
            line.setAttribute("x2", margin.left + width);
            line.setAttribute("y2", y);
            line.setAttribute("stroke", "rgba(255, 255, 255, 0.08)");
            line.setAttribute("stroke-dasharray", "4");
            svg.appendChild(line);

            // Labels
            const text = document.createElementNS(svgns, "text");
            text.setAttribute("x", margin.left - 8);
            text.setAttribute("y", y + 4);
            text.setAttribute("text-anchor", "end");
            text.setAttribute("fill", "#9ca3af");
            text.setAttribute("font-size", "10");
            text.setAttribute("font-family", "monospace");
            text.textContent = ((maxVal * (4 - i)) / 4).toFixed(3);
            svg.appendChild(text);
        }

        // Draw bars
        values.forEach((val, i) => {
            const h = (val / maxVal) * height;
            const x = margin.left + i * barWidth + 8;
            const y = margin.top + height - h;
            const w = Math.max(1, barWidth - 16);

            const rect = document.createElementNS(svgns, "rect");
            rect.setAttribute("x", x);
            rect.setAttribute("y", y);
            rect.setAttribute("width", w);
            rect.setAttribute("height", h);
            rect.setAttribute("fill", color);
            rect.setAttribute("rx", "4");

            // Add simple tooltip value
            const title = document.createElementNS(svgns, "title");
            title.textContent = `${labels[i]}: ${val}`;
            rect.appendChild(title);
            svg.appendChild(rect);

            // Label text below bar
            const labelText = document.createElementNS(svgns, "text");
            labelText.setAttribute("x", x + w/2);
            labelText.setAttribute("y", margin.top + height + 16);
            labelText.setAttribute("text-anchor", "middle");
            labelText.setAttribute("fill", "#d1d5db");
            labelText.setAttribute("font-size", "9");
            labelText.setAttribute("font-weight", "bold");
            labelText.textContent = labels[i];
            svg.appendChild(labelText);
        });

        return svg;
    }

    function createHeatmapSVG(matrix) {
        // Truncate to maximum 12x12 for visualization clarity and speed
        const maxRows = 12;
        const maxCols = 12;
        
        const numRows = Math.min(matrix.length, maxRows);
        const numCols = Math.min(matrix[0].length, maxCols);

        const svgns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgns, "svg");
        svg.setAttribute("viewBox", "0 0 250 250");
        svg.className = "visual-svg heatmap";

        const cellSize = 18;
        const gap = 2;
        const totalW = numCols * cellSize + (numCols - 1) * gap;
        const totalH = numRows * cellSize + (numRows - 1) * gap;
        
        // Center alignment
        const startX = (250 - totalW) / 2;
        const startY = (250 - totalH) / 2;

        // Flatten values to find min / max for normalization
        let allVals = [];
        for(let r=0; r<numRows; r++) {
            for(let c=0; c<numCols; c++) {
                allVals.push(matrix[r][c]);
            }
        }
        
        const minVal = Math.min(...allVals);
        const maxVal = Math.max(...allVals);
        const range = maxVal - minVal || 1;

        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
                const val = matrix[r][c];
                const x = startX + c * (cellSize + gap);
                const y = startY + r * (cellSize + gap);

                // Normalize color between cyan (positive) and violet (negative)
                // Zero is represented by dark slate
                let color = "rgba(31, 41, 55, 0.4)";
                if (val > 0) {
                    const intensity = val / (maxVal || 1);
                    color = `rgba(6, 182, 212, ${Math.max(0.15, intensity)})`;
                } else if (val < 0) {
                    const intensity = Math.abs(val) / (Math.abs(minVal) || 1);
                    color = `rgba(139, 92, 246, ${Math.max(0.15, intensity)})`;
                }

                const rect = document.createElementNS(svgns, "rect");
                rect.setAttribute("x", x);
                rect.setAttribute("y", y);
                rect.setAttribute("width", cellSize);
                rect.setAttribute("height", cellSize);
                rect.setAttribute("fill", color);
                rect.setAttribute("rx", "2");
                rect.setAttribute("stroke", "rgba(255, 255, 255, 0.05)");

                const tooltip = document.createElementNS(svgns, "title");
                tooltip.textContent = `[Row ${r}, Col ${c}]: ${val.toFixed(5)}`;
                rect.appendChild(tooltip);

                svg.appendChild(rect);
            }
        }

        // Add visual indicator if truncated
        if (matrix.length > maxRows || matrix[0].length > maxCols) {
            const warnText = document.createElementNS(svgns, "text");
            warnText.setAttribute("x", "125");
            warnText.setAttribute("y", "240");
            warnText.setAttribute("text-anchor", "middle");
            warnText.setAttribute("fill", "#6b7280");
            warnText.setAttribute("font-size", "8");
            warnText.setAttribute("font-style", "italic");
            warnText.textContent = `Truncated (showing first ${numRows}x${numCols})`;
            svg.appendChild(warnText);
        }

        return svg;
    }

    // --- Formatting Helpers ---
    function formatNumber(num) {
        if (typeof num !== 'number') return String(num);
        let str = num.toFixed(4);
        if (num >= 0) {
            str = ' ' + str;
        }
        return str;
    }

    function formatValue(val) {
        if (!Array.isArray(val)) {
            if (typeof val === 'number') {
                return formatNumber(val);
            }
            return String(val);
        }

        if (val.length === 0) return '[]';

        // 1D array
        if (!Array.isArray(val[0])) {
            return `[ ${val.map(formatNumber).join(', ')} ]`;
        }

        // 2D matrix
        if (!Array.isArray(val[0][0])) {
            return `[\n` + val.map(row => `  [ ${row.map(formatNumber).join(', ')} ]`).join(',\n') + `\n]`;
        }

        // 3D tensor
        if (!Array.isArray(val[0][0][0])) {
            return val.map((slice, idx) => `  Slice [${idx}, :, :]:\n` + (
                `  [\n` + slice.map(row => `    [ ${row.map(formatNumber).join(', ')} ]`).join(',\n') + `\n  ]`
            )).join('\n\n');
        }

        // List of 2D factor matrices
        if (Array.isArray(val[0]) && Array.isArray(val[0][0]) && !Array.isArray(val[0][0][0])) {
            return val.map((matrix, idx) => `  Factor Matrix [Mode ${idx + 1}]:\n` + (
                `  [\n` + matrix.map(row => `    [ ${row.map(formatNumber).join(', ')} ]`).join(',\n') + `\n  ]`
            )).join('\n\n');
        }

        return JSON.stringify(val, (k, v) => {
            if (typeof v === 'number') return parseFloat(v.toFixed(4));
            return v;
        }, 2);
    }

    function formatKeyLabel(key) {
        if (key === 'vh') return 'V^H (Conjugate Transpose)';
        if (key === 'u') return 'U (Left Singular Vectors)';
        if (key === 'q') return 'Q (Orthogonal Matrix)';
        if (key === 'r') return 'R (Upper Triangular Matrix)';
        if (key === 'l') return 'L (Lower Triangular Matrix)';
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    function formatResultMatrixStyle(result) {
        if (!result || typeof result !== 'object') return JSON.stringify(result, null, 2);
        if (Array.isArray(result)) return formatValue(result);

        let parts = [];
        if (result.method) {
            parts.push(`Algorithm Method: ${result.method.toUpperCase()}\n`);
        }

        for (let key in result) {
            if (key === 'method') continue;
            let val = result[key];
            parts.push(`${formatKeyLabel(key)}:`);
            parts.push(formatValue(val));
            parts.push('');
        }
        return parts.join('\n').trim();
    }

    function formatAnalysisStyle(analysis) {
        if (!analysis || typeof analysis !== 'object') return JSON.stringify(analysis, null, 2);
        let formatted = {};
        for (let key in analysis) {
            let val = analysis[key];
            if (typeof val === 'number') {
                formatted[key] = parseFloat(val.toFixed(4));
            } else {
                formatted[key] = val;
            }
        }
        return JSON.stringify(formatted, null, 2);
    }

    function formatSimpleJSON(obj) {
        return JSON.stringify(obj, (k, v) => {
            if (typeof v === 'number') return parseFloat(v.toFixed(4));
            return v;
        }, 2);
    }

    function autoFormatInitialPanels() {
        const decompPre = panelDecomposition.querySelector("pre");
        if (decompPre && decompPre.textContent.trim()) {
            try {
                const parsed = JSON.parse(decompPre.textContent);
                decompPre.textContent = formatResultMatrixStyle(parsed);
            } catch (e) {
                // Not JSON or already formatted
            }
        }

        const analysisPre = panelAnalysis.querySelector("pre");
        if (analysisPre && analysisPre.textContent.trim()) {
            try {
                const parsed = JSON.parse(analysisPre.textContent);
                analysisPre.textContent = formatAnalysisStyle(parsed);
            } catch (e) {
                // Error
            }
        }

        const benchmarkPre = panelBenchmark.querySelector("pre");
        if (benchmarkPre && benchmarkPre.textContent.trim()) {
            try {
                const parsed = JSON.parse(benchmarkPre.textContent);
                benchmarkPre.textContent = formatSimpleJSON(parsed);
            } catch (e) {
                // Error
            }
        }

        const comparisonPre = panelComparison.querySelector("pre");
        if (comparisonPre && comparisonPre.textContent.trim()) {
            try {
                const parsed = JSON.parse(comparisonPre.textContent);
                comparisonPre.textContent = formatSimpleJSON(parsed);
            } catch (e) {
                // Error
            }
        }
    }

    // Auto format initial panels on load
    autoFormatInitialPanels();
});
