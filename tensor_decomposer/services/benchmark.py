from __future__ import annotations

from time import perf_counter
from typing import Any

import numpy as np

from .algorithms import run_algorithm
from .analysis import analyze_decomposition


def estimate_flops(shape: tuple[int, ...], algorithm: str, last_result: dict[str, Any] | None) -> int:
    def svd_flops(m: int, n: int) -> int:
        M, N = max(m, n), min(m, n)
        return int(4 * (M**2) * N + 8 * M * (N**2) + 9 * (N**3))

    if len(shape) >= 3:
        n1, n2, n3 = shape[0], shape[1], shape[2]
        if algorithm == "tensor_train":
            r1, r2 = 1, 1
            if last_result and "cores" in last_result:
                try:
                    cores = last_result["cores"]
                    r1 = np.array(cores[0]).shape[2]
                    r2 = np.array(cores[1]).shape[2]
                except Exception:
                    pass
            return svd_flops(n1, n2 * n3) + svd_flops(r1 * n2, n3)
        elif algorithm in ("tucker", "hosvd"):
            r1, r2, r3 = n1, n2, n3
            if last_result and "core" in last_result:
                try:
                    c_shape = np.array(last_result["core"]).shape
                    r1, r2, r3 = c_shape[0], c_shape[1], c_shape[2]
                except Exception:
                    pass
            return (
                svd_flops(n1, n2 * n3) +
                svd_flops(n2, n1 * n3) +
                svd_flops(n3, n1 * n2) +
                2 * n1 * n2 * n3 * (r1 + r2 + r3)
            )
        elif algorithm == "cp":
            R = 5
            if last_result and "factors" in last_result:
                try:
                    factors = last_result["factors"]
                    R = np.array(factors[0]).shape[1]
                except Exception:
                    pass
            return 50 * (6 * n1 * n2 * n3 * R + 3 * (n1 + n2 + n3) * (R**2) + 3 * (R**3))
    else:
        m = shape[0]
        n = shape[1] if len(shape) > 1 else 1
        
        if algorithm == "svd":
            return svd_flops(m, n)
        elif algorithm == "qr":
            M, N = max(m, n), min(m, n)
            return int(2 * (N**2) * (M - N/3.0))
        elif algorithm == "lu":
            M, N = max(m, n), min(m, n)
            return int(2/3.0 * (N**3) + (N**2) * (M - N))
        elif algorithm == "eigendecomposition":
            return int(9 * (m**3))
            
    return int(m * n)


def get_complexity_formula(shape: tuple[int, ...], algorithm: str) -> str:
    if len(shape) >= 3:
        if algorithm == "tensor_train":
            return "O(N₁N₂N₃R)"
        elif algorithm in ("tucker", "hosvd"):
            return "O(N₁N₂N₃(∑R_i) + ∑SVD_i)"
        elif algorithm == "cp":
            return "O(N₁N₂N₃R • Iterations)"
    else:
        if algorithm == "svd":
            return "O(4M²N + 8MN² + 9N³)"
        elif algorithm == "qr":
            return "O(2N²(M - N/3))"
        elif algorithm == "lu":
            return "O(2/3 N³ + N²(M-N))"
        elif algorithm == "eigendecomposition":
            return "O(9 N³)"
    return "O(N)"


def benchmark_algorithm(array: np.ndarray, algorithm: str, repeats: int = 1) -> dict[str, Any]:
    if repeats < 1:
        raise ValueError("Benchmark repeats must be at least 1")

    durations_ms: list[float] = []
    last_result: dict[str, Any] | None = None

    for _ in range(repeats):
        start = perf_counter()
        last_result = run_algorithm(array, algorithm)
        durations_ms.append((perf_counter() - start) * 1000)

    flops = estimate_flops(array.shape, algorithm, last_result)
    if flops >= 1e9:
        flops_str = f"{flops / 1e9:.2f} GFLOPs"
    elif flops >= 1e6:
        flops_str = f"{flops / 1e6:.2f} MFLOPs"
    elif flops >= 1e3:
        flops_str = f"{flops / 1e3:.2f} KFLOPs"
    else:
        flops_str = f"{flops} FLOPs"

    complexity = get_complexity_formula(array.shape, algorithm)
    
    # Calculate compression analysis details
    original_parameters = int(array.size)
    compressed_parameters = original_parameters
    compression_ratio = 1.0
    if last_result:
        try:
            analysis = analyze_decomposition(array, algorithm, last_result)
            original_parameters = analysis.get("original_parameters", original_parameters)
            compressed_parameters = analysis.get("compressed_parameters", compressed_parameters)
            compression_ratio = analysis.get("compression_ratio", compression_ratio)
        except Exception:
            pass

    return {
        "algorithm": algorithm,
        "repeats": repeats,
        "execution_time_ms": round(float(sum(durations_ms) / len(durations_ms)), 3),
        "flops": flops,
        "flops_str": flops_str,
        "complexity": complexity,
        "original_parameters": original_parameters,
        "compressed_parameters": compressed_parameters,
        "compression_ratio": compression_ratio,
        "result_keys": list((last_result or {}).keys()),
    }