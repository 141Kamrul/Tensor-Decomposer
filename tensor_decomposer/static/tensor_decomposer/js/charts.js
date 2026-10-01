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

    const baseAlgo = (algorithm || "").toLowerCase().replace("_puzzle", "").replace("+puzzle", "");
    const shape = getTensorShape(inputTensor);

    // Dynamic handling for Tensor Train across any number of dimensions (2D, 3D, 4D, etc.)
    if (baseAlgo === "tensor_train" && result.cores && Array.isArray(result.cores) && result.cores.length > 0) {
        const cores = result.cores;
        const numCores = cores.length;

        // Collect all dimension sizes and TT ranks to establish global proportional scale
        const allDims = [...shape];
        if (result.ranks) allDims.push(...result.ranks);
        cores.forEach(c => {
            const cs = getTensorShape(c);
            allDims.push(...cs);
        });
        const maxDim = Math.max(...allDims.filter(v => typeof v === 'number' && !isNaN(v)), 1);
        const s = (val) => Math.max(14, Math.min(80, (val / maxDim) * 85));

        // Draw input tensor X on the left
        const H_x = s(shape[0] || 1);
        const W_x = s(shape[1] || 1);
        const D_x = shape.length >= 3 ? s(shape[2] || 1) : 0;
        const x0_x = 130, y0_x = 175;
        const inputGroup = createIsometricBlock(
            svgns, x0_x, y0_x, H_x, W_x, D_x, "#06b6d4", "X", 
            { h: shape[0], w: shape[1], d: shape.length >= 3 ? shape.slice(2).join("×") : "" }
        );
        svg.appendChild(inputGroup);

        // Shape label under X
        svg.appendChild(drawTextLabel(svgns, x0_x, 265, `Shape: ${shape.join("×")}`, "10"));

        // Equals / Approx sign
        svg.appendChild(drawTextLabel(svgns, 230, 175, "≈", "28", "bold"));

        // Dynamically space cores across canvas width 260 -> 780
        const startX = 260;
        const endX = 780;
        const slotWidth = (endX - startX) / numCores;

        cores.forEach((core, idx) => {
            const cShape = getTensorShape(core);
            const rPrev = cShape[0] || 1;
            const nK = cShape[1] || shape[idx] || 1;
            const rNext = cShape[2] || 1;

            const cx = startX + (idx + 0.5) * slotWidth;
            const cy = 175;

            let h = s(nK), w = s(rNext), d = s(rPrev);
            if (idx === 0) {
                h = s(nK);
                w = s(rNext);
                d = 0;
            } else if (idx === numCores - 1) {
                h = s(rPrev);
                w = 0;
                d = s(nK);
            }

            const color = idx % 2 === 0 ? "#ec4899" : "#8b5cf6";
            const coreGroup = createIsometricBlock(
                svgns, cx, cy, h, w, d, color, `Core ${idx + 1}`,
                { h: nK, w: rNext > 1 ? rNext : "", d: rPrev > 1 ? rPrev : "" }
            );
            svg.appendChild(coreGroup);

            // Dimension label under each core
            const dimLabel = `${rPrev}×${nK}×${rNext}`;
            svg.appendChild(drawTextLabel(svgns, cx, 265, dimLabel, "10"));

            // Contraction dot between cores
            if (idx < numCores - 1) {
                const dotX = startX + (idx + 1) * slotWidth;
                svg.appendChild(drawTextLabel(svgns, dotX, 175, "•", "22", "bold"));
            }
        });

        return svg;
    }
    
    if (shape.length >= 3) {
        const n1 = shape[0], n2 = shape[1], n3 = shape[2];
        let r1 = n1, r2 = n2, r3 = n3;
        let R = 1;
        
        if (baseAlgo === "cp") {
            if (result.factors && result.factors[0]) {
                R = result.factors[0][0].length || result.factors[0].length;
            }
            r1 = R; r2 = R; r3 = R;
        } else if (baseAlgo === "tucker" || baseAlgo === "hosvd") {
            if (result.core) {
                const coreShape = getTensorShape(result.core);
                r1 = coreShape[0] || r1;
                r2 = coreShape[1] || r2;
                r3 = coreShape[2] || r3;
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
        
        const coreLabel = baseAlgo === "cp" ? "λ" : "G";
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
    } else {
        const n1 = shape[0] || 1;
        const n2 = shape[1] || 1;
        let r = Math.min(n1, n2);
        
        if (result.singular_values) {
            if (Array.isArray(result.singular_values[0])) {
                r = result.singular_values[0].length;
            } else {
                r = result.singular_values.length;
            }
        }
        else if (result.eigenvalues) r = result.eigenvalues.length;
        else if (result.weights) r = result.weights.length;
        else if (result.ranks && Array.isArray(result.ranks)) r = result.ranks[0];
        else if (result.rank) r = result.rank;
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

        const isExact = (baseAlgo === "qr" || baseAlgo === "lu" || baseAlgo === "eigendecomposition");
        svg.appendChild(drawTextLabel(svgns, 260, 180, isExact ? "=" : "≈", "28", "bold"));

        let curX = 320;
        if (baseAlgo === "svd") {
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
        } else if (baseAlgo === "cp") {
            const H_a1 = s(n1), W_a1 = s(r);
            const y0_a1 = 175 - H_a1 / 2;
            const a1Group = createFlat2DBlock(svgns, curX, y0_a1, W_a1, H_a1, "#ec4899", "A(1)", n1, r);
            svg.appendChild(a1Group);
            
            curX += W_a1 + 15;
            
            const H_lam = s(r), W_lam = s(r);
            const y0_lam = 175 - H_lam / 2;
            const lamGroup = createFlat2DBlock(svgns, curX, y0_lam, W_lam, H_lam, "#8b5cf6", "λ", r, r, true);
            svg.appendChild(lamGroup);
            
            curX += W_lam + 15;
            
            const H_a2 = s(r), W_a2 = s(n2);
            const y0_a2 = 175 - H_a2 / 2;
            const a2Group = createFlat2DBlock(svgns, curX, y0_a2, W_a2, H_a2, "#ec4899", "A(2)ᵀ", r, n2);
            svg.appendChild(a2Group);
        } else if (baseAlgo === "tucker" || baseAlgo === "hosvd") {
            let r1 = r, r2 = r;
            if (result.ranks && result.ranks.length >= 2) {
                r1 = result.ranks[0];
                r2 = result.ranks[1];
            } else if (result.core) {
                const cShape = getTensorShape(result.core);
                r1 = cShape[0] || r1;
                r2 = cShape[1] || r2;
            }
            const H_a1 = s(n1), W_a1 = s(r1);
            const y0_a1 = 175 - H_a1 / 2;
            const a1Group = createFlat2DBlock(svgns, curX, y0_a1, W_a1, H_a1, "#ec4899", "A(1)", n1, r1);
            svg.appendChild(a1Group);
            
            curX += W_a1 + 15;
            
            const H_core = s(r1), W_core = s(r2);
            const y0_core = 175 - H_core / 2;
            const coreGroup = createFlat2DBlock(svgns, curX, y0_core, W_core, H_core, "#8b5cf6", "G", r1, r2);
            svg.appendChild(coreGroup);
            
            curX += W_core + 15;
            
            const H_a2 = s(r2), W_a2 = s(n2);
            const y0_a2 = 175 - H_a2 / 2;
            const a2Group = createFlat2DBlock(svgns, curX, y0_a2, W_a2, H_a2, "#ec4899", "A(2)ᵀ", r2, n2);
            svg.appendChild(a2Group);
        } else if (baseAlgo === "tensor_train") {
            let r1 = r;
            if (result.ranks && result.ranks.length > 1) {
                r1 = result.ranks[1];
            }
            const H_c1 = s(n1), W_c1 = s(r1);
            const y0_c1 = 175 - H_c1 / 2;
            const c1Group = createFlat2DBlock(svgns, curX, y0_c1, W_c1, H_c1, "#ec4899", "Core 1", n1, r1);
            svg.appendChild(c1Group);
            
            curX += W_c1 + 15;
            svg.appendChild(drawTextLabel(svgns, curX + 5, 180, "•", "22", "bold"));
            curX += 25;
            
            const H_c2 = s(r1), W_c2 = s(n2);
            const y0_c2 = 175 - H_c2 / 2;
            const c2Group = createFlat2DBlock(svgns, curX, y0_c2, W_c2, H_c2, "#8b5cf6", "Core 2", r1, n2);
            svg.appendChild(c2Group);
        } else if (baseAlgo === "eigendecomposition") {
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
        } else if (baseAlgo === "qr") {
            const H_q = s(n1), W_q = s(n1);
            const y0_q = 175 - H_q / 2;
            const qGroup = createFlat2DBlock(svgns, curX, y0_q, W_q, H_q, "#ec4899", "Q", n1, n1);
            svg.appendChild(qGroup);
            
            curX += W_q + 15;
            
            const H_r = s(n1), W_r = s(n2);
            const y0_r = 175 - H_r / 2;
            const rGroup = createFlat2DBlock(svgns, curX, y0_r, W_r, H_r, "#8b5cf6", "R", n1, n2);
            svg.appendChild(rGroup);
        } else if (baseAlgo === "lu") {
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
    const baseAlgo = (algorithm || "").toLowerCase().replace("_puzzle", "").replace("+puzzle", "");
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
            let slice2D = inputTensor;
            while (Array.isArray(slice2D) && Array.isArray(slice2D[0]) && Array.isArray(slice2D[0][0])) {
                slice2D = slice2D[0];
            }
            const sShape = getTensorShape(slice2D);
            items.push({
                label: `Original Input Tensor (2D Slice, Shape: ${shape.join("x")})`,
                data: slice2D,
                rows: sShape[0] || 1,
                cols: sShape[1] || 1,
                type: "heatmap"
            });
        }
    }

    // 2. Singular Values / Eigenvalues / Weights
    if (result.singular_values && Array.isArray(result.singular_values)) {
        if (result.singular_values.length > 0 && Array.isArray(result.singular_values[0])) {
            result.singular_values.forEach((modeVals, idx) => {
                if (Array.isArray(modeVals) && modeVals.length > 0) {
                    const prefix = baseAlgo === "tensor_train" ? `Cut ${idx + 1}` : `Mode ${idx + 1}`;
                    items.push({
                        label: `Singular Value Spectrum (${prefix})`,
                        data: modeVals,
                        rows: 1,
                        cols: modeVals.length,
                        type: "bar"
                    });
                }
            });
        } else {
            items.push({
                label: "Singular Value Spectrum",
                data: result.singular_values,
                rows: 1,
                cols: result.singular_values.length,
                type: "bar"
            });
        }
    }

    if (result.eigenvalues && Array.isArray(result.eigenvalues)) {
        items.push({
            label: "Eigenvalue Spectrum",
            data: result.eigenvalues,
            rows: 1,
            cols: result.eigenvalues.length,
            type: "bar"
        });
    }

    if (result.weights && Array.isArray(result.weights)) {
        items.push({
            label: "Component Weights Spectrum (λ)",
            data: result.weights,
            rows: 1,
            cols: result.weights.length,
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
            let coreSlice2D = core;
            while (Array.isArray(coreSlice2D) && Array.isArray(coreSlice2D[0]) && Array.isArray(coreSlice2D[0][0])) {
                coreSlice2D = coreSlice2D[0];
            }
            const sShape = getTensorShape(coreSlice2D);
            items.push({
                label: `Core Tensor (2D Slice, Shape: ${shape.join("x")})`,
                data: coreSlice2D,
                rows: sShape[0] || 1,
                cols: sShape[1] || 1,
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
                let coreSlice2D = core;
                while (Array.isArray(coreSlice2D) && Array.isArray(coreSlice2D[0]) && Array.isArray(coreSlice2D[0][0])) {
                    coreSlice2D = coreSlice2D[0];
                }
                const sShape = getTensorShape(coreSlice2D);
                items.push({
                    label: `TT Core ${idx + 1} (2D Slice, Shape: ${shape.join("x")})`,
                    data: coreSlice2D,
                    rows: sShape[0] || 1,
                    cols: sShape[1] || 1,
                    type: "heatmap"
                });
            }
        });
    }

    return items;
}

export function createBarChartSVG(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return document.createElementNS("http://www.w3.org/2000/svg", "svg");
    }
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("viewBox", "0 0 400 200");
    svg.setAttribute("class", "visual-svg");

    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = 400 - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    const numData = data.map(v => {
        if (typeof v === 'number' && !isNaN(v)) return v;
        if (typeof v === 'string') {
            const p = parseFloat(v);
            return isNaN(p) ? 0 : p;
        }
        if (Array.isArray(v) && typeof v[0] === 'number') return v[0];
        return 0;
    });

    const maxVal = Math.max(...numData.map(v => Math.abs(v)), 1e-9);
    const barWidth = width / (data.length || 1);

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
    data.forEach((rawVal, i) => {
        const numVal = numData[i];
        const h = Math.min(height, (Math.abs(numVal) / maxVal) * height);
        const x = margin.left + i * barWidth + 2;
        const y = margin.top + height - h;
        const w = Math.max(1, barWidth - 4);

        const rect = document.createElementNS(svgns, "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", w);
        rect.setAttribute("height", Math.max(1, h));
        rect.setAttribute("fill", "url(#bar-gradient)");
        rect.setAttribute("rx", "3");

        let displayVal = rawVal;
        if (typeof rawVal === 'number') {
            displayVal = rawVal.toFixed(5);
        } else if (Array.isArray(rawVal)) {
            displayVal = JSON.stringify(rawVal);
        }

        const title = document.createElementNS(svgns, "title");
        title.textContent = `Index ${i}: ${displayVal}`;
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

export function createComparisonBarChart(labels, values, color, type = "default") {
    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");

    const numItems = Math.max(1, values.length);
    const minSlotWidth = 115;
    const margin = { top: 38, right: 35, bottom: 85, left: 65 };
    const width = Math.max(900, numItems * minSlotWidth);
    const height = 180;
    const totalWidth = width + margin.left + margin.right;
    const totalHeight = height + margin.top + margin.bottom;

    svg.setAttribute("viewBox", `0 0 ${totalWidth} ${totalHeight}`);
    svg.setAttribute("class", "visual-svg comparison-svg");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";

    function formatMethodName(raw) {
        if (!raw) return "";
        const str = String(raw).trim();
        const clean = str.toLowerCase().replace("+", "_");
        const map = {
            "cp": "CP Decomposition",
            "tucker": "Tucker Decomposition",
            "hosvd": "HOSVD",
            "tensor_train": "Tensor Train (TT)",
            "cp_puzzle": "CP + PuzzleTensor",
            "tucker_puzzle": "Tucker + PuzzleTensor",
            "hosvd_puzzle": "HOSVD + PuzzleTensor",
            "tensor_train_puzzle": "TT + PuzzleTensor",
            "svd": "SVD",
            "eigendecomposition": "Eigendecomposition",
            "qr": "QR Decomposition",
            "lu": "LU Decomposition",
        };
        return map[clean] || str.toUpperCase().replace(/_/g, " ");
    }

    function formatBarValue(val) {
        if (typeof val !== "number" || isNaN(val)) return String(val ?? "");
        if (type === "ratio") {
            return `${val.toFixed(2)}x`;
        }
        if (type === "time") {
            return `${val.toFixed(2)} ms`;
        }
        if (type === "error") {
            if (val === 0) return "0";
            if (val < 1e-4) return val.toExponential(2);
            return val.toFixed(4);
        }
        if (val >= 100) return val.toFixed(1);
        if (val < 0.001 && val > 0) return val.toExponential(2);
        return val.toFixed(3);
    }

    function formatTick(val) {
        if (val === 0) return "0";
        if (type === "ratio") return `${val.toFixed(1)}x`;
        if (type === "time") return `${val.toFixed(0)}ms`;
        if (val < 0.01) return val.toExponential(1);
        if (val >= 100) return val.toFixed(0);
        return val.toFixed(2);
    }

    const maxVal = Math.max(...values, 0) || 1;
    const slotWidth = width / numItems;
    const barWidth = Math.min(52, Math.max(26, slotWidth * 0.42));

    // Gradient definition for rich aesthetic bars
    const defs = document.createElementNS(svgns, "defs");
    const gradId = `comp-grad-${Math.random().toString(36).substring(2, 9)}`;
    const grad = document.createElementNS(svgns, "linearGradient");
    grad.setAttribute("id", gradId);
    grad.setAttribute("x1", "0%");
    grad.setAttribute("y1", "0%");
    grad.setAttribute("x2", "0%");
    grad.setAttribute("y2", "100%");

    const stop1 = document.createElementNS(svgns, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", color);
    stop1.setAttribute("stop-opacity", "0.95");
    grad.appendChild(stop1);

    const stop2 = document.createElementNS(svgns, "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", color);
    stop2.setAttribute("stop-opacity", "0.65");
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    // Subtle background grid lines and Y-axis scale labels
    const numTicks = 4;
    for (let i = 0; i <= numTicks; i++) {
        const y = margin.top + (height / numTicks) * i;
        const line = document.createElementNS(svgns, "line");
        line.setAttribute("x1", margin.left);
        line.setAttribute("y1", y);
        line.setAttribute("x2", margin.left + width);
        line.setAttribute("y2", y);
        line.setAttribute("stroke", "var(--panel-border, rgba(255, 255, 255, 0.1))");
        line.setAttribute("stroke-dasharray", "4,4");
        line.setAttribute("opacity", "0.7");
        svg.appendChild(line);

        const tickVal = (maxVal * (numTicks - i)) / numTicks;
        const text = document.createElementNS(svgns, "text");
        text.setAttribute("x", margin.left - 10);
        text.setAttribute("y", y + 4);
        text.setAttribute("text-anchor", "end");
        text.setAttribute("fill", "var(--text-muted, #94a3b8)");
        text.setAttribute("font-size", "11");
        text.setAttribute("font-family", "monospace");
        text.textContent = formatTick(tickVal);
        svg.appendChild(text);
    }

    // Baseline horizontal axis line
    const baseLine = document.createElementNS(svgns, "line");
    baseLine.setAttribute("x1", margin.left);
    baseLine.setAttribute("y1", margin.top + height);
    baseLine.setAttribute("x2", margin.left + width);
    baseLine.setAttribute("y2", margin.top + height);
    baseLine.setAttribute("stroke", "var(--card-border, rgba(255, 255, 255, 0.2))");
    baseLine.setAttribute("stroke-width", "1.5");
    svg.appendChild(baseLine);

    // Draw bars, top values, and angled X-axis labels
    values.forEach((val, i) => {
        const normVal = Math.max(0, val);
        const rawH = (normVal / maxVal) * height;
        const h = Math.max(normVal > 0 ? 3 : 1, rawH);
        const x = margin.left + i * slotWidth + (slotWidth - barWidth) / 2;
        const y = margin.top + height - h;

        // Bar rectangle
        const rect = document.createElementNS(svgns, "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", barWidth);
        rect.setAttribute("height", h);
        rect.setAttribute("fill", `url(#${gradId})`);
        rect.setAttribute("rx", "4");
        rect.style.transition = "opacity 0.2s, transform 0.2s";
        rect.style.cursor = "pointer";

        const formattedMethod = formatMethodName(labels[i]);
        const valStr = formatBarValue(val);

        // Tooltip
        const title = document.createElementNS(svgns, "title");
        title.textContent = `${formattedMethod}: ${valStr}`;
        rect.appendChild(title);
        svg.appendChild(rect);

        // Value text placed right above bar
        const valText = document.createElementNS(svgns, "text");
        valText.setAttribute("x", x + barWidth / 2);
        valText.setAttribute("y", Math.max(margin.top - 8, y - 6));
        valText.setAttribute("text-anchor", "middle");
        valText.setAttribute("fill", "var(--text-secondary, #cbd5e1)");
        valText.setAttribute("font-size", "11");
        valText.setAttribute("font-family", "monospace");
        valText.setAttribute("font-weight", "600");
        valText.textContent = valStr;
        svg.appendChild(valText);

        // Angled X-axis label with generous space
        const labelGroup = document.createElementNS(svgns, "g");
        const labelAnchorX = x + barWidth / 2;
        const labelAnchorY = margin.top + height + 16;
        labelGroup.setAttribute(
            "transform",
            `translate(${labelAnchorX}, ${labelAnchorY}) rotate(-28)`
        );

        const labelText = document.createElementNS(svgns, "text");
        labelText.setAttribute("x", 0);
        labelText.setAttribute("y", 0);
        labelText.setAttribute("text-anchor", "end");
        labelText.setAttribute("fill", "var(--text-primary, #f8fafc)");
        labelText.setAttribute("font-size", "11");
        labelText.setAttribute("font-weight", "600");
        labelText.setAttribute("letter-spacing", "0.2px");
        labelText.textContent = formattedMethod;
        labelGroup.appendChild(labelText);
        svg.appendChild(labelGroup);
    });

    return svg;
}

export function createHeatmapSVG(matrix, actualRows, actualCols, globalMax) {
    if (!matrix || !Array.isArray(matrix) || matrix.length === 0) {
        return document.createElementNS("http://www.w3.org/2000/svg", "svg");
    }
    // Truncate to maximum 12x12 for visualization clarity and speed
    const maxRows = 12;
    const maxCols = 12;
    
    const numRows = Math.min(matrix.length, maxRows);
    const numCols = Math.min(Array.isArray(matrix[0]) ? matrix[0].length : 1, maxCols);

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
    const widthPx = Math.max(30, (actualCols / (globalMax || 1)) * maxPixelSize);
    const heightPx = Math.max(30, (actualRows / (globalMax || 1)) * maxPixelSize);
    
    svg.style.width = `${widthPx}px`;
    svg.style.height = `${heightPx}px`;
    svg.style.margin = "0 auto";
    svg.style.display = "block";

    // Flatten values to find min / max for normalization
    let allNumericVals = [];
    for(let r=0; r<numRows; r++) {
        for(let c=0; c<numCols; c++) {
            const raw = Array.isArray(matrix[r]) ? matrix[r][c] : matrix[r];
            if (typeof raw === 'number' && !isNaN(raw)) {
                allNumericVals.push(raw);
            } else if (typeof raw === 'string') {
                const parsed = parseFloat(raw);
                if (!isNaN(parsed)) allNumericVals.push(parsed);
            }
        }
    }
    
    const minVal = allNumericVals.length ? Math.min(...allNumericVals) : 0;
    const maxVal = allNumericVals.length ? Math.max(...allNumericVals) : 1;

    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            const val = Array.isArray(matrix[r]) ? matrix[r][c] : matrix[r];
            const numVal = typeof val === 'number' ? val : (parseFloat(val) || 0);
            const x = c * (cellSize + gap);
            const y = r * (cellSize + gap);

            // Normalize color between cyan (positive) and violet (negative)
            // Zero is represented by dark slate
            let color = "var(--heatmap-zero)";
            if (numVal > 0) {
                const intensity = numVal / (maxVal || 1);
                color = `rgba(6, 182, 212, ${Math.max(0.15, Math.min(1, intensity))})`;
            } else if (numVal < 0) {
                const intensity = Math.abs(numVal) / (Math.abs(minVal) || 1);
                color = `rgba(139, 92, 246, ${Math.max(0.15, Math.min(1, intensity))})`;
            }

            const rect = document.createElementNS(svgns, "rect");
            rect.setAttribute("x", x);
            rect.setAttribute("y", y);
            rect.setAttribute("width", cellSize);
            rect.setAttribute("height", cellSize);
            rect.setAttribute("fill", color);
            rect.setAttribute("rx", "2");
            rect.setAttribute("stroke", "var(--panel-border)");

            let displayVal = val;
            if (typeof val === 'number') {
                displayVal = val.toFixed(5);
            }

            const tooltip = document.createElementNS(svgns, "title");
            tooltip.textContent = `[Row ${r}, Col ${c}]: ${displayVal}`;
            rect.appendChild(tooltip);

            svg.appendChild(rect);
        }
    }

    return svg;
}
