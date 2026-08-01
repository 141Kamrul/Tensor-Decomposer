import { initTheme } from './theme.js';
import { 
    formatNumber, 
    formatValue, 
    formatResultMatrixStyle, 
    formatAnalysisStyle, 
    formatSimpleJSON 
} from './helpers.js';
import { 
    renderVisualizations, 
    renderBenchmarkChart, 
    renderComparisonCharts 
} from './visualizer.js';

document.addEventListener("DOMContentLoaded", () => {
    // Initialize Theme
    initTheme();

    const form = document.querySelector(".tensor-form");
    if (!form) return;

    const resultsColumn = document.querySelector(".results-column");
    
    // Mutual exclusion between manual text input and file upload
    const inputTextArea = document.getElementById("tensor_input");
    const fileInputField = document.getElementById("tensor_file");
    
    if (inputTextArea && fileInputField) {
        inputTextArea.addEventListener("input", () => {
            if (inputTextArea.value.trim() !== "") {
                fileInputField.value = "";
            }
        });
        
        fileInputField.addEventListener("change", () => {
            if (fileInputField.files.length > 0) {
                inputTextArea.value = "";
            }
        });
    }

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

    // Input state tracking and response caching variables
    let lastInputState = {
        tensorInput: "",
        tensorFile: "",
        algorithm: ""
    };
    let cachedDecomp = null;

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

        const currentInputState = {
            tensorInput: tensorInput,
            tensorFile: tensorFile ? tensorFile.name : "",
            algorithm: document.getElementById("algorithm").value
        };

        const inputChanged = 
            currentInputState.tensorInput !== lastInputState.tensorInput ||
            currentInputState.tensorFile !== lastInputState.tensorFile ||
            currentInputState.algorithm !== lastInputState.algorithm;

        if (inputChanged) {
            hideAllPanels();
            cachedDecomp = null;
            lastInputState = currentInputState;
        }

        // Show loading state
        loader.classList.add("active");

        try {
            // Determine if we can use cached decomposition data
            if ((action === "decompose" || action === "analyze" || action === "visualize") && cachedDecomp) {
                // Use cached data
                handleSuccess(action, cachedDecomp);
                return;
            }

            // Otherwise, make the network request
            // If the action is visualize or analyze, we request 'decompose' to get all factors & analysis
            let requestAction = action;
            if (action === "visualize" || action === "analyze") {
                requestAction = "decompose";
            }
            formData.set("action", requestAction);

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

            if (requestAction === "decompose") {
                cachedDecomp = data;
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
        if (panelError) panelError.classList.add("hidden");
        if (panelDecomposition) panelDecomposition.classList.add("hidden");
        if (panelAnalysis) panelAnalysis.classList.add("hidden");
        if (panelBenchmark) panelBenchmark.classList.add("hidden");
        if (panelComparison) panelComparison.classList.add("hidden");
        if (panelVisualization) panelVisualization.classList.add("hidden");
        
        // Hide nested visualization containers
        const bViz = document.getElementById("benchmark-visualization-container");
        if (bViz) bViz.style.display = "none";
        const cViz = document.getElementById("comparison-visualization-container");
        if (cViz) cViz.style.display = "none";
    }

    function showError(message) {
        hideAllPanels();
        if (panelError) {
            const errorMessage = panelError.querySelector(".error-message");
            if (errorMessage) errorMessage.textContent = message;
            panelError.classList.remove("hidden");
            panelError.scrollIntoView({ behavior: "smooth" });
        }
    }

    function handleSuccess(action, data) {
        // Clear any previous error
        if (panelError) panelError.classList.add("hidden");

        if (action === "compare") {
            // Hide all individual panels when showing comparison
            if (panelDecomposition) panelDecomposition.classList.add("hidden");
            if (panelAnalysis) panelAnalysis.classList.add("hidden");
            if (panelVisualization) panelVisualization.classList.add("hidden");
            if (panelBenchmark) panelBenchmark.classList.add("hidden");
            
            const bViz = document.getElementById("benchmark-visualization-container");
            if (bViz) bViz.style.display = "none";

            if (data.comparison && panelComparison) {
                const tbody = panelComparison.querySelector("tbody");
                if (tbody) {
                    tbody.innerHTML = "";
                    data.comparison.forEach(row => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
                            <td class="font-semibold text-cyan-400">${row.algorithm.toUpperCase()}</td>
                            <td><span class="badge badge-teal">${row.compression_ratio}x</span></td>
                            <td><span class="badge badge-purple">${row.relative_error}</span></td>
                            <td class="font-mono text-gray-300">${row.execution_time_ms} ms</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
                
                const pre = panelComparison.querySelector("pre");
                if (pre) pre.textContent = formatSimpleJSON(data.comparison);
                panelComparison.classList.remove("hidden");
                
                // Visualize comparison
                renderComparisonCharts(data.comparison);
                panelComparison.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        } 
        else {
            // Hide comparison panel when showing any individual panel
            if (panelComparison) panelComparison.classList.add("hidden");
            const cViz = document.getElementById("comparison-visualization-container");
            if (cViz) cViz.style.display = "none";

            if (action === "decompose") {
                if (data.result && panelDecomposition) {
                    const pre = panelDecomposition.querySelector("pre");
                    const dl = panelDecomposition.querySelector(".download-btn");
                    if (pre) pre.textContent = formatResultMatrixStyle(data.result);
                    if (dl && data.download_url) {
                        dl.href = `/download/${data.download_url}/`;
                        dl.classList.remove("hidden");
                    }
                    panelDecomposition.classList.remove("hidden");
                    panelDecomposition.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            } 
            else if (action === "analyze") {
                if (data.analysis && panelAnalysis) {
                    // Update analysis metrics
                    const maeEl = document.getElementById("metric-mae");
                    const rmseEl = document.getElementById("metric-rmse");
                    const relErrEl = document.getElementById("metric-rel-error");
                    const reconHeadEl = document.getElementById("metric-recon-head");

                    if (maeEl) maeEl.textContent = formatNumber(data.analysis.mean_absolute_error);
                    if (rmseEl) rmseEl.textContent = formatNumber(data.analysis.root_mean_squared_error);
                    if (relErrEl) relErrEl.textContent = formatNumber(data.analysis.relative_error);
                    if (reconHeadEl) reconHeadEl.textContent = formatValue(data.analysis.reconstructed_head);
                    
                    const pre = panelAnalysis.querySelector("pre");
                    if (pre) pre.textContent = formatAnalysisStyle(data.analysis);
                    panelAnalysis.classList.remove("hidden");
                    panelAnalysis.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            } 
            else if (action === "visualize") {
                if (data.result) {
                    renderVisualizations(data.algorithm, data.result, data.tensor);
                    if (panelVisualization) {
                        panelVisualization.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                }
            } 
            else if (action === "benchmark") {
                if (data.benchmark && panelBenchmark) {
                    const avgTimeEl = document.getElementById("metric-avg-time");
                    const minTimeEl = document.getElementById("metric-min-time");
                    const maxTimeEl = document.getElementById("metric-max-time");
                    const compRatioEl = document.getElementById("metric-compression-ratio");
                    const benchParamsEl = document.getElementById("metric-benchmark-params");
                    const runsEl = document.getElementById("metric-runs");

                    if (avgTimeEl) avgTimeEl.textContent = `${data.benchmark.execution_time_ms} ms`;
                    if (minTimeEl) minTimeEl.textContent = data.benchmark.flops_str;
                    if (maxTimeEl) maxTimeEl.textContent = data.benchmark.complexity;
                    if (compRatioEl) compRatioEl.textContent = `${data.benchmark.compression_ratio}x`;
                    if (benchParamsEl) benchParamsEl.textContent = `${data.benchmark.compressed_parameters} / ${data.benchmark.original_parameters}`;
                    if (runsEl) runsEl.textContent = data.benchmark.repeats;
                    
                    const pre = panelBenchmark.querySelector("pre");
                    if (pre) pre.textContent = formatSimpleJSON(data.benchmark);
                    panelBenchmark.classList.remove("hidden");
                    
                    // Visualize benchmarks
                    renderBenchmarkChart(data.benchmark);
                    panelBenchmark.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            }
        }
    }

    function autoFormatInitialPanels() {
        if (panelDecomposition) {
            const decompPre = panelDecomposition.querySelector("pre");
            if (decompPre && decompPre.textContent.trim()) {
                try {
                    const parsed = JSON.parse(decompPre.textContent);
                    decompPre.textContent = formatResultMatrixStyle(parsed);
                } catch (e) {
                    // Not JSON or already formatted
                }
            }
        }

        if (panelAnalysis) {
            const analysisPre = panelAnalysis.querySelector("pre");
            if (analysisPre && analysisPre.textContent.trim()) {
                try {
                    const parsed = JSON.parse(analysisPre.textContent);
                    analysisPre.textContent = formatAnalysisStyle(parsed);
                    
                    const maeEl = document.getElementById("metric-mae");
                    const rmseEl = document.getElementById("metric-rmse");
                    const relErrEl = document.getElementById("metric-rel-error");
                    const reconHeadEl = document.getElementById("metric-recon-head");

                    if (maeEl && parsed.mean_absolute_error !== undefined) {
                        maeEl.textContent = formatNumber(parsed.mean_absolute_error);
                    }
                    if (rmseEl && parsed.root_mean_squared_error !== undefined) {
                        rmseEl.textContent = formatNumber(parsed.root_mean_squared_error);
                    }
                    if (relErrEl && parsed.relative_error !== undefined) {
                        relErrEl.textContent = formatNumber(parsed.relative_error);
                    }
                    if (reconHeadEl && parsed.reconstructed_head !== undefined) {
                        reconHeadEl.textContent = formatValue(parsed.reconstructed_head);
                    }
                } catch (e) {
                    // Error
                }
            }
        }

        if (panelBenchmark) {
            const benchmarkPre = panelBenchmark.querySelector("pre");
            if (benchmarkPre && benchmarkPre.textContent.trim()) {
                try {
                    const parsed = JSON.parse(benchmarkPre.textContent);
                    benchmarkPre.textContent = formatSimpleJSON(parsed);
                } catch (e) {
                    // Error
                }
            }
        }

        if (panelComparison) {
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
    }

    // Auto format initial panels on load
    autoFormatInitialPanels();
});
