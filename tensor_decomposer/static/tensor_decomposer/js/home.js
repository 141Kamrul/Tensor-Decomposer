document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".tensor-form");
    const resultsColumn = document.querySelector(".results-column");
    
    // Theme Toggle Handler
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
            const newTheme = currentTheme === "light" ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem("theme", newTheme);
        });
    }
    
    
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
        panelError.classList.add("hidden");
        panelDecomposition.classList.add("hidden");
        panelAnalysis.classList.add("hidden");
        panelBenchmark.classList.add("hidden");
        panelComparison.classList.add("hidden");
        panelVisualization.classList.add("hidden");
        
        // Hide nested visualization containers
        const bViz = document.getElementById("benchmark-visualization-container");
        if (bViz) bViz.style.display = "none";
        const cViz = document.getElementById("comparison-visualization-container");
        if (cViz) cViz.style.display = "none";
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

        if (action === "compare") {
            // Hide all individual panels when showing comparison
            panelDecomposition.classList.add("hidden");
            panelAnalysis.classList.add("hidden");
            panelVisualization.classList.add("hidden");
            panelBenchmark.classList.add("hidden");
            
            const bViz = document.getElementById("benchmark-visualization-container");
            if (bViz) bViz.style.display = "none";

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
                panelComparison.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        } 
        else {
            // Hide comparison panel when showing any individual panel
            panelComparison.classList.add("hidden");
            const cViz = document.getElementById("comparison-visualization-container");
            if (cViz) cViz.style.display = "none";

            if (action === "decompose") {
                if (data.result) {
                    const pre = panelDecomposition.querySelector("pre");
                    const dl = panelDecomposition.querySelector(".download-btn");
                    pre.textContent = formatResultMatrixStyle(data.result);
                    if (dl && data.download_url) {
                        dl.href = `/download/${data.download_url}/`;
                        dl.classList.remove("hidden");
                    }
                    panelDecomposition.classList.remove("hidden");
                    panelDecomposition.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            } 
            else if (action === "analyze") {
                if (data.analysis) {
                    // Update analysis metrics
                    document.getElementById("metric-compression").textContent = data.analysis.compression_ratio;
                    document.getElementById("metric-abs-error").textContent = data.analysis.absolute_error;
                    document.getElementById("metric-rel-error").textContent = data.analysis.relative_error;
                    document.getElementById("metric-params").textContent = `${data.analysis.compressed_parameters} / ${data.analysis.original_parameters}`;
                    
                    panelAnalysis.querySelector("pre").textContent = formatAnalysisStyle(data.analysis);
                    panelAnalysis.classList.remove("hidden");
                    panelAnalysis.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            } 
            else if (action === "visualize") {
                if (data.result) {
                    renderVisualizations(data.algorithm, data.result, data.tensor);
                    panelVisualization.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            } 
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
                    panelBenchmark.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            }
        }
    }

    // --- Visualization Engine ---
    
    function getTensorShape(tensor) {
        if (!Array.isArray(tensor)) return [];
        const shape = [];
        let current = tensor;
        while (Array.isArray(current)) {
            shape.push(current.length);
            current = current[0];
        }
        return shape;
    }

    function getIsoCoords(x0, y0, h, w, d) {
        // w goes down-left: (-0.866, 0.5)
        // d goes down-right: (0.866, 0.5)
        // h goes straight up: (0, -1)
        const px = x0 - 0.866 * w + 0.866 * d;
        const py = y0 - h + 0.5 * w + 0.5 * d;
        return { x: px, y: py };
    }

    function drawTextLabel(svgns, x, y, content, fontSize = "20", fontStyle = "normal") {
        const text = document.createElementNS(svgns, "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "var(--text-muted)");
        text.setAttribute("font-size", fontSize);
        if (fontStyle === "bold") {
            text.setAttribute("font-weight", "bold");
        }
        text.textContent = content;
        return text;
    }

    function createIsometricBlock(svgns, x0, y0, h, w, d, baseColor, label, dimLabels) {
        const group = document.createElementNS(svgns, "g");
        
        const p000 = getIsoCoords(x0, y0, 0, 0, 0);
        const p010 = getIsoCoords(x0, y0, h, 0, 0);
        const p100 = getIsoCoords(x0, y0, 0, w, 0);
        const p110 = getIsoCoords(x0, y0, h, w, 0);
        const p001 = getIsoCoords(x0, y0, 0, 0, d);
        const p011 = getIsoCoords(x0, y0, h, 0, d);
        const p101 = getIsoCoords(x0, y0, 0, w, d);
        const p111 = getIsoCoords(x0, y0, h, w, d);

        // Draw Back Wireframe (Dashed) if 3D (i.e. all h, w, d > 0)
        if (h > 0 && w > 0 && d > 0) {
            const backEdges = [
                [p100, p101],
                [p001, p101],
                [p111, p101]
            ];
            backEdges.forEach(edge => {
                const line = document.createElementNS(svgns, "line");
                line.setAttribute("x1", edge[0].x);
                line.setAttribute("y1", edge[0].y);
                line.setAttribute("x2", edge[1].x);
                line.setAttribute("y2", edge[1].y);
                line.setAttribute("stroke", "rgba(255, 255, 255, 0.25)");
                line.setAttribute("stroke-dasharray", "3,3");
                line.setAttribute("stroke-width", "1.2");
                group.appendChild(line);
            });
        }

        // Polygons list
        const polygons = [];
        
        // Left face
        if (h > 0 && w > 0) {
            polygons.push({
                points: `${p000.x},${p000.y} ${p010.x},${p010.y} ${p110.x},${p110.y} ${p100.x},${p100.y}`,
                opacity: 0.7
            });
        }
        // Right face
        if (h > 0 && d > 0) {
            polygons.push({
                points: `${p000.x},${p000.y} ${p001.x},${p001.y} ${p011.x},${p011.y} ${p010.x},${p010.y}`,
                opacity: 0.55
            });
        }
        // Top face
        if (w > 0 && d > 0) {
            polygons.push({
                points: `${p010.x},${p010.y} ${p011.x},${p011.y} ${p111.x},${p111.y} ${p110.x},${p110.y}`,
                opacity: 0.85
            });
        }

        // Special case for flat 2D planes:
        if (polygons.length === 0) {
            if (h === 0 && w > 0 && d > 0) {
                polygons.push({
                    points: `${p000.x},${p000.y} ${p001.x},${p001.y} ${p101.x},${p101.y} ${p100.x},${p100.y}`,
                    opacity: 0.75
                });
            }
        }

        polygons.forEach(face => {
            const poly = document.createElementNS(svgns, "polygon");
            poly.setAttribute("points", face.points);
            poly.setAttribute("fill", baseColor);
            poly.setAttribute("fill-opacity", face.opacity);
            poly.setAttribute("stroke", "rgba(255, 255, 255, 0.4)");
            poly.setAttribute("stroke-width", "1.2");
            group.appendChild(poly);
        });

        // Add Label in the center of the block
        const cx = (p000.x + p111.x) / 2;
        const cy = (p000.y + p111.y) / 2;
        
        const text = document.createElementNS(svgns, "text");
        text.setAttribute("x", cx);
        text.setAttribute("y", cy + 4);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#ffffff");
        text.setAttribute("font-size", "11");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("style", "text-shadow: 0px 1px 3px rgba(0,0,0,0.8); pointer-events: none;");
        text.textContent = label;
        group.appendChild(text);

        // Add Dimension Labels
        if (dimLabels) {
            if (dimLabels.h && h > 0) {
                const tx = p000.x - 12;
                const ty = p000.y - h/2;
                const t = document.createElementNS(svgns, "text");
                t.setAttribute("x", tx);
                t.setAttribute("y", ty);
                t.setAttribute("text-anchor", "end");
                t.setAttribute("fill", "var(--text-muted)");
                t.setAttribute("font-size", "10");
                t.setAttribute("font-family", "monospace");
                t.textContent = dimLabels.h;
                group.appendChild(t);
            }
            if (dimLabels.w && w > 0) {
                const tx = (p000.x + p100.x) / 2 - 10;
                const ty = (p000.y + p100.y) / 2 + 15;
                const t = document.createElementNS(svgns, "text");
                t.setAttribute("x", tx);
                t.setAttribute("y", ty);
                t.setAttribute("text-anchor", "middle");
                t.setAttribute("fill", "var(--text-muted)");
                t.setAttribute("font-size", "10");
                t.setAttribute("font-family", "monospace");
                t.textContent = dimLabels.w;
                group.appendChild(t);
            }
            if (dimLabels.d && d > 0) {
                const tx = (p000.x + p001.x) / 2 + 10;
                const ty = (p000.y + p001.y) / 2 + 15;
                const t = document.createElementNS(svgns, "text");
                t.setAttribute("x", tx);
                t.setAttribute("y", ty);
                t.setAttribute("text-anchor", "middle");
                t.setAttribute("fill", "var(--text-muted)");
                t.setAttribute("font-size", "10");
                t.setAttribute("font-family", "monospace");
                t.textContent = dimLabels.d;
                group.appendChild(t);
            }
        }

        return group;
    }

    function createFlat2DBlock(svgns, x, y, w, h, baseColor, label, dimH, dimW, isDiagonal = false) {
        const group = document.createElementNS(svgns, "g");
        
        const rect = document.createElementNS(svgns, "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", w);
        rect.setAttribute("height", h);
        rect.setAttribute("fill", baseColor);
        rect.setAttribute("fill-opacity", "0.75");
        rect.setAttribute("stroke", "rgba(255, 255, 255, 0.4)");
        rect.setAttribute("stroke-width", "1.5");
        rect.setAttribute("rx", "3");
        group.appendChild(rect);

        if (isDiagonal) {
            const line = document.createElementNS(svgns, "line");
            line.setAttribute("x1", x);
            line.setAttribute("y1", y);
            line.setAttribute("x2", x + w);
            line.setAttribute("y2", y + h);
            line.setAttribute("stroke", "rgba(255, 255, 255, 0.35)");
            line.setAttribute("stroke-width", "1.5");
            line.setAttribute("stroke-dasharray", "2,2");
            group.appendChild(line);
        }

        group.appendChild(drawTextLabel(svgns, x + w/2, y + h/2 + 4, label, "12", "bold"));
        
        group.appendChild(drawTextLabel(svgns, x - 12, y + h/2 + 4, dimH, "9"));
        group.appendChild(drawTextLabel(svgns, x + w/2, y + h + 13, dimW, "9"));

        return group;
    }

    function createEquationSVG(algorithm, result, inputTensor) {
        const svgns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgns, "svg");
        svg.setAttribute("viewBox", "0 0 800 350");
        svg.className = "visual-svg equation-svg";
        svg.style.width = "100%";
        svg.style.height = "auto";
        svg.style.maxHeight = "350px";
        svg.style.display = "block";
        svg.style.margin = "0 auto";

        const shape = getTensorShape(inputTensor);
        
        if (shape.length >= 3) {
            const n1 = shape[0], n2 = shape[1], n3 = shape[2];
            let r1 = n1, r2 = n2, r3 = n3;
            let R = 1;
            
            if (algorithm === "cp") {
                if (result.factors && result.factors[0]) {
                    R = result.factors[0][0].length || result.factors[0].length;
                }
                r1 = R; r2 = R; r3 = R;
            } else if (algorithm === "tucker" || algorithm === "hosvd") {
                if (result.core) {
                    const coreShape = getTensorShape(result.core);
                    r1 = coreShape[0] || r1;
                    r2 = coreShape[1] || r2;
                    r3 = coreShape[2] || r3;
                }
            } else if (algorithm === "tensor_train") {
                if (result.cores) {
                    const c1Shape = getTensorShape(result.cores[0]);
                    const c2Shape = getTensorShape(result.cores[1]);
                    r1 = c1Shape[2] || r1;
                    r2 = c2Shape[2] || r2;
                }
            }

            const maxDim = Math.max(n1, n2, n3, r1, r2, r3);
            const s = (val) => Math.max(15, (val / maxDim) * 90);

            const H_x = s(n1), W_x = s(n2), D_x = s(n3);
            const x0_x = 180, y0_x = 180;
            const inputGroup = createIsometricBlock(svgns, x0_x, y0_x, H_x, W_x, D_x, "#06b6d4", "X", { h: n1, w: n2, d: n3 });
            svg.appendChild(inputGroup);

            svg.appendChild(drawTextLabel(svgns, 310, 180, "≈", "32", "bold"));

            const x_c = 550, y_c = 180;
            const H_g = s(r1), W_g = s(r2), D_g = s(r3);
            
            if (algorithm === "tensor_train") {
                const c1Group = createIsometricBlock(svgns, 420, 180, s(n1), s(r1), 0, "#ec4899", "Core 1", { h: n1, w: r1 });
                svg.appendChild(c1Group);
                
                svg.appendChild(drawTextLabel(svgns, 480, 180, "•", "24", "bold"));

                const c2Group = createIsometricBlock(svgns, 560, 180, s(r1), s(n2), s(r2), "#8b5cf6", "Core 2", { h: r1, w: n2, d: r2 });
                svg.appendChild(c2Group);
                
                svg.appendChild(drawTextLabel(svgns, 650, 180, "•", "24", "bold"));

                const c3Group = createIsometricBlock(svgns, 720, 180, s(r2), 0, s(n3), "#ec4899", "Core 3", { h: r2, d: n3 });
                svg.appendChild(c3Group);
            } else {
                const coreLabel = algorithm === "cp" ? "λ" : "G";
                const coreGroup = createIsometricBlock(svgns, x_c, y_c, H_g, W_g, D_g, "#8b5cf6", coreLabel, { h: r1, w: r2, d: r3 });
                svg.appendChild(coreGroup);

                const H_a1 = s(n1), W_a1 = s(r1);
                const x0_a1 = x_c - 0.866 * W_g - 40;
                const y0_a1 = y_c + 0.5 * W_g - 20;
                const a1Group = createIsometricBlock(svgns, x0_a1, y0_a1, H_a1, W_a1, 0, "#ec4899", "A(1)", { h: n1, w: r1 });
                svg.appendChild(a1Group);

                const W_a2 = s(n2), D_a2 = s(r2);
                const x0_a2 = x_c - 0.866 * W_g - 20;
                const y0_a2 = y_c + 0.5 * W_g + 45;
                const a2Group = createIsometricBlock(svgns, x0_a2, y0_a2, 0, W_a2, D_a2, "#ec4899", "A(2)", { w: n2, d: r2 });
                svg.appendChild(a2Group);

                const H_a3 = s(r3), D_a3 = s(n3);
                const x0_a3 = x_c + 0.866 * D_g + 40;
                const y0_a3 = y_c + 0.5 * D_g - 20;
                const a3Group = createIsometricBlock(svgns, x0_a3, y0_a3, H_a3, 0, D_a3, "#ec4899", "A(3)", { h: r3, d: n3 });
                svg.appendChild(a3Group);
            }
        } else {
            const n1 = shape[0] || 1;
            const n2 = shape[1] || 1;
            let r = Math.min(n1, n2);
            
            if (result.singular_values) r = result.singular_values.length;
            else if (result.eigenvalues) r = result.eigenvalues.length;
            else if (result.q) {
                const qShape = getTensorShape(result.q);
                r = qShape[1] || r;
            }

            const maxDim = Math.max(n1, n2, r);
            const s = (val) => Math.max(15, (val / maxDim) * 120);

            const H_x = s(n1), W_x = s(n2);
            const x0_x = 100, y0_x = 175 - H_x / 2;
            
            const xGroup = document.createElementNS(svgns, "g");
            const xRect = document.createElementNS(svgns, "rect");
            xRect.setAttribute("x", x0_x);
            xRect.setAttribute("y", y0_x);
            xRect.setAttribute("width", W_x);
            xRect.setAttribute("height", H_x);
            xRect.setAttribute("fill", "#06b6d4");
            xRect.setAttribute("fill-opacity", "0.75");
            xRect.setAttribute("stroke", "rgba(255, 255, 255, 0.4)");
            xRect.setAttribute("stroke-width", "1.5");
            xRect.setAttribute("rx", "3");
            xGroup.appendChild(xRect);
            
            xGroup.appendChild(drawTextLabel(svgns, x0_x + W_x/2, y0_x + H_x/2 + 4, "X", "13", "bold"));
            xGroup.appendChild(drawTextLabel(svgns, x0_x - 15, y0_x + H_x/2 + 4, n1, "10"));
            xGroup.appendChild(drawTextLabel(svgns, x0_x + W_x/2, y0_x + H_x + 15, n2, "10"));
            svg.appendChild(xGroup);

            const isExact = (algorithm === "qr" || algorithm === "lu" || algorithm === "eigendecomposition");
            svg.appendChild(drawTextLabel(svgns, 260, 180, isExact ? "=" : "≈", "28", "bold"));

            let curX = 320;
            if (algorithm === "svd") {
                const H_u = s(n1), W_u = s(r);
                const y0_u = 175 - H_u / 2;
                const uGroup = createFlat2DBlock(svgns, curX, y0_u, W_u, H_u, "#ec4899", "U", n1, r);
                svg.appendChild(uGroup);
                
                curX += W_u + 15;
                
                const H_s = s(r), W_s = s(r);
                const y0_s = 175 - H_s / 2;
                const sGroup = createFlat2DBlock(svgns, curX, y0_s, W_s, H_s, "#8b5cf6", "S", r, r, true);
                svg.appendChild(sGroup);
                
                curX += W_s + 15;
                
                const H_v = s(r), W_v = s(n2);
                const y0_v = 175 - H_v / 2;
                const vGroup = createFlat2DBlock(svgns, curX, y0_v, W_v, H_v, "#ec4899", "Vᵀ", r, n2);
                svg.appendChild(vGroup);
            } else if (algorithm === "eigendecomposition") {
                const H_q = s(n1), W_q = s(r);
                const y0_q = 175 - H_q / 2;
                const qGroup = createFlat2DBlock(svgns, curX, y0_q, W_q, H_q, "#ec4899", "Q", n1, r);
                svg.appendChild(qGroup);
                
                curX += W_q + 15;
                
                const H_l = s(r), W_l = s(r);
                const y0_l = 175 - H_l / 2;
                const lGroup = createFlat2DBlock(svgns, curX, y0_l, W_l, H_l, "#8b5cf6", "Λ", r, r, true);
                svg.appendChild(lGroup);
                
                curX += W_l + 15;
                
                const H_qi = s(r), W_qi = s(n1);
                const y0_qi = 175 - H_qi / 2;
                const qiGroup = createFlat2DBlock(svgns, curX, y0_qi, W_qi, H_qi, "#ec4899", "Q⁻¹", r, n1);
                svg.appendChild(qiGroup);
            } else if (algorithm === "qr") {
                const H_q = s(n1), W_q = s(n1);
                const y0_q = 175 - H_q / 2;
                const qGroup = createFlat2DBlock(svgns, curX, y0_q, W_q, H_q, "#ec4899", "Q", n1, n1);
                svg.appendChild(qGroup);
                
                curX += W_q + 15;
                
                const H_r = s(n1), W_r = s(n2);
                const y0_r = 175 - H_r / 2;
                const rGroup = createFlat2DBlock(svgns, curX, y0_r, W_r, H_r, "#8b5cf6", "R", n1, n2);
                svg.appendChild(rGroup);
            } else if (algorithm === "lu") {
                const H_l = s(n1), W_l = s(n1);
                const y0_l = 175 - H_l / 2;
                const lGroup = createFlat2DBlock(svgns, curX, y0_l, W_l, H_l, "#ec4899", "L", n1, n1);
                svg.appendChild(lGroup);
                
                curX += W_l + 15;
                
                const H_u = s(n1), W_u = s(n2);
                const y0_u = 175 - H_u / 2;
                const uGroup = createFlat2DBlock(svgns, curX, y0_u, W_u, H_u, "#8b5cf6", "U", n1, n2);
                svg.appendChild(uGroup);
            }
        }

        return svg;
    }

    function getVisualizationItems(algorithm, result, inputTensor) {
        const items = [];
        
        // 1. Input Tensor
        if (inputTensor && Array.isArray(inputTensor)) {
            const shape = getTensorShape(inputTensor);
            if (shape.length === 1) {
                items.push({
                    label: "Original Input Tensor (1D)",
                    data: inputTensor.map(v => [v]),
                    rows: shape[0],
                    cols: 1,
                    type: "heatmap"
                });
            } else if (shape.length === 2) {
                items.push({
                    label: "Original Input Tensor (2D)",
                    data: inputTensor,
                    rows: shape[0],
                    cols: shape[1],
                    type: "heatmap"
                });
            } else if (shape.length >= 3) {
                items.push({
                    label: `Original Input Tensor (Mode-1 First Slice, Shape: ${shape.join("x")})`,
                    data: inputTensor[0],
                    rows: shape[1],
                    cols: shape[2],
                    type: "heatmap"
                });
            }
        }

        // 2. Singular / Eigenvalues
        if (result.singular_values || result.eigenvalues) {
            const vals = result.singular_values || result.eigenvalues;
            items.push({
                label: result.singular_values ? "Singular Value Spectrum" : "Eigenvalue Spectrum",
                data: vals,
                rows: 1,
                cols: vals.length,
                type: "bar"
            });
        }

        // 3. Factors (CP, Tucker, HOSVD)
        if (result.factors && Array.isArray(result.factors)) {
            result.factors.forEach((factor, idx) => {
                const shape = getTensorShape(factor);
                items.push({
                    label: `Factor Matrix - Mode ${idx + 1} (${shape.join("x")})`,
                    data: factor,
                    rows: shape[0] || 1,
                    cols: shape[1] || 1,
                    type: "heatmap"
                });
            });
        }

        // 4. Core Tensor
        if (result.core) {
            const core = result.core;
            const shape = getTensorShape(core);
            if (shape.length === 2) {
                items.push({
                    label: `Core Tensor (${shape.join("x")})`,
                    data: core,
                    rows: shape[0],
                    cols: shape[1],
                    type: "heatmap"
                });
            } else if (shape.length >= 3) {
                items.push({
                    label: `Core Tensor (Mode-1 First Slice, Shape: ${shape.join("x")})`,
                    data: core[0],
                    rows: shape[1],
                    cols: shape[2],
                    type: "heatmap"
                });
            }
        }

        // 5. Reference Matrix outputs
        const matrices = ["u", "vh", "q", "r", "l"];
        matrices.forEach(key => {
            if (result[key] && Array.isArray(result[key])) {
                const data = result[key];
                const shape = getTensorShape(data);
                items.push({
                    label: `Matrix: ${key.toUpperCase()} (${shape.join("x")})`,
                    data: data,
                    rows: shape[0] || 1,
                    cols: shape[1] || 1,
                    type: "heatmap"
                });
            }
        });

        // 6. TT Cores
        if (result.cores && Array.isArray(result.cores)) {
            result.cores.forEach((core, idx) => {
                const shape = getTensorShape(core);
                if (shape.length === 2) {
                    items.push({
                        label: `TT Core ${idx + 1} (${shape.join("x")})`,
                        data: core,
                        rows: shape[0],
                        cols: shape[1],
                        type: "heatmap"
                    });
                } else if (shape.length >= 3) {
                    items.push({
                        label: `TT Core ${idx + 1} (Mode-1 First Slice, Shape: ${shape.join("x")})`,
                        data: core[0],
                        rows: shape[1],
                        cols: shape[2],
                        type: "heatmap"
                    });
                }
            });
        }

        return items;
    }

    function renderVisualizations(algorithm, result, inputTensor) {
        const container = document.getElementById("visualization-container");
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

    function renderBenchmarkChart(benchmark) {
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
    }

    function createVisualCard(title, subtitle) {
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
            line.setAttribute("stroke", "var(--panel-border)");
            line.setAttribute("stroke-dasharray", "4");
            svg.appendChild(line);

            // Labels
            const text = document.createElementNS(svgns, "text");
            text.setAttribute("x", margin.left - 8);
            text.setAttribute("y", y + 4);
            text.setAttribute("text-anchor", "end");
            text.setAttribute("fill", "var(--text-muted)");
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
            line.setAttribute("stroke", "var(--panel-border)");
            line.setAttribute("stroke-dasharray", "4");
            svg.appendChild(line);

            // Labels
            const text = document.createElementNS(svgns, "text");
            text.setAttribute("x", margin.left - 8);
            text.setAttribute("y", y + 4);
            text.setAttribute("text-anchor", "end");
            text.setAttribute("fill", "var(--text-muted)");
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
            labelText.setAttribute("fill", "var(--text-primary)");
            labelText.setAttribute("font-size", "9");
            labelText.setAttribute("font-weight", "bold");
            labelText.textContent = labels[i];
            svg.appendChild(labelText);
        });

        return svg;
    }

    function createHeatmapSVG(matrix, actualRows, actualCols, globalMax) {
        // Truncate to maximum 12x12 for visualization clarity and speed
        const maxRows = 12;
        const maxCols = 12;
        
        const numRows = Math.min(matrix.length, maxRows);
        const numCols = Math.min(matrix[0].length, maxCols);

        const svgns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgns, "svg");
        
        const cellSize = 18;
        const gap = 2;
        const totalW = numCols * cellSize + (numCols - 1) * gap;
        const totalH = numRows * cellSize + (numRows - 1) * gap;
        
        svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
        svg.className = "visual-svg heatmap";
        svg.style.aspectRatio = "auto";
        svg.style.maxWidth = "none";
        svg.style.maxHeight = "none";

        // Calculate ratio-wise visual sizes
        const maxPixelSize = 200; // standard maximum bounds
        const widthPx = Math.max(30, (actualCols / globalMax) * maxPixelSize);
        const heightPx = Math.max(30, (actualRows / globalMax) * maxPixelSize);
        
        svg.style.width = `${widthPx}px`;
        svg.style.height = `${heightPx}px`;
        svg.style.margin = "0 auto";
        svg.style.display = "block";

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
                const x = c * (cellSize + gap);
                const y = r * (cellSize + gap);

                // Normalize color between cyan (positive) and violet (negative)
                // Zero is represented by dark slate
                let color = "var(--heatmap-zero)";
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
                rect.setAttribute("stroke", "var(--panel-border)");

                const tooltip = document.createElementNS(svgns, "title");
                tooltip.textContent = `[Row ${r}, Col ${c}]: ${val.toFixed(5)}`;
                rect.appendChild(tooltip);

                svg.appendChild(rect);
            }
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
