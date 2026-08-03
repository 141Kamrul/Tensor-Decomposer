import { getTensorShape } from './helpers.js';

export function getIsoCoords(x0, y0, h, w, d) {
    // w goes down-left: (-0.866, 0.5)
    // d goes down-right: (0.866, 0.5)
    // h goes straight up: (0, -1)
    const px = x0 - 0.866 * w + 0.866 * d;
    const py = y0 - h + 0.5 * w + 0.5 * d;
    return { x: px, y: py };
}

export function drawTextLabel(svgns, x, y, content, fontSize = "20", fontStyle = "normal") {
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

export function createIsometricBlock(svgns, x0, y0, h, w, d, baseColor, label, dimLabels) {
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

export function createFlat2DBlock(svgns, x, y, w, h, baseColor, label, dimH, dimW, isDiagonal = false) {
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

export function createEquationSVG(algorithm, result, inputTensor) {
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("viewBox", "0 0 800 350");
    svg.setAttribute("class", "visual-svg equation-svg");
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

export function getVisualizationItems(algorithm, result, inputTensor) {
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

export function createBarChartSVG(data) {
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("viewBox", "0 0 400 200");
    svg.setAttribute("class", "visual-svg");

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

export function createComparisonBarChart(labels, values, color) {
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("viewBox", "0 0 400 200");
    svg.setAttribute("class", "visual-svg");

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

export function createHeatmapSVG(matrix, actualRows, actualCols, globalMax) {
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
    svg.setAttribute("class", "visual-svg heatmap");
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
