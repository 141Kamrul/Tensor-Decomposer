export function getTensorShape(tensor) {
    if (!Array.isArray(tensor)) return [];
    const shape = [];
    let current = tensor;
    while (Array.isArray(current)) {
        shape.push(current.length);
        current = current[0];
    }
    return shape;
}

export function extract2DSlice(tensor3D, sliceAxis = 0, sliceIndex = 0) {
    if (!Array.isArray(tensor3D)) return [];
    const shape = getTensorShape(tensor3D);
    if (shape.length < 3) return tensor3D;

    const axisDim = shape[sliceAxis] || 1;
    const idx = Math.max(0, Math.min(sliceIndex, axisDim - 1));

    if (shape.length === 3) {
        if (sliceAxis === 0) {
            return tensor3D[idx] || [];
        }
        if (sliceAxis === 1) {
            return tensor3D.map(plane => (Array.isArray(plane) ? plane[idx] || [] : []));
        }
        if (sliceAxis === 2) {
            return tensor3D.map(plane =>
                Array.isArray(plane)
                    ? plane.map(row => (Array.isArray(row) ? row[idx] ?? 0 : 0))
                    : []
            );
        }
    }

    if (sliceAxis === 0) {
        let current = tensor3D[idx];
        while (Array.isArray(current) && Array.isArray(current[0]) && Array.isArray(current[0][0])) {
            current = current[0];
        }
        return current || [];
    }

    return extract2DSliceND(tensor3D, sliceAxis, idx, 0);
}

function extract2DSliceND(arr, targetAxis, targetIdx, currentAxis) {
    if (!Array.isArray(arr)) return arr;
    if (currentAxis === targetAxis) {
        return arr[targetIdx] || [];
    }
    return arr.map(sub => extract2DSliceND(sub, targetAxis, targetIdx, currentAxis + 1));
}

export function formatNumber(num) {
    if (typeof num !== 'number') return String(num);
    let str = num.toFixed(4);
    if (num >= 0) {
        str = ' ' + str;
    }
    return str;
}

export function formatValue(val) {
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

export function formatKeyLabel(key) {
    if (key === 'vh') return 'V^H (Conjugate Transpose)';
    if (key === 'u') return 'U (Left Singular Vectors)';
    if (key === 'q') return 'Q (Orthogonal Matrix)';
    if (key === 'r') return 'R (Upper Triangular Matrix)';
    if (key === 'l') return 'L (Lower Triangular Matrix)';
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function formatResultMatrixStyle(result) {
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

export function formatAnalysisStyle(analysis) {
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

export function formatSimpleJSON(obj) {
    return JSON.stringify(obj, (k, v) => {
        if (typeof v === 'number') return parseFloat(v.toFixed(4));
        return v;
    }, 2);
}
