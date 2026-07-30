from __future__ import annotations

from time import perf_counter
from typing import Any

import numpy as np

from .algorithms import run_algorithm


def benchmark_algorithm(array: np.ndarray, algorithm: str, repeats: int = 5) -> dict[str, Any]:
    if repeats < 1:
        raise ValueError("Benchmark repeats must be at least 1")

    durations_ms: list[float] = []
    last_result: dict[str, Any] | None = None

    for _ in range(repeats):
        start = perf_counter()
        last_result = run_algorithm(array, algorithm)
        durations_ms.append((perf_counter() - start) * 1000)

    return {
        "algorithm": algorithm,
        "repeats": repeats,
        "average_ms": round(float(sum(durations_ms) / len(durations_ms)), 3),
        "min_ms": round(float(min(durations_ms)), 3),
        "max_ms": round(float(max(durations_ms)), 3),
        "result_keys": list((last_result or {}).keys()),
    }