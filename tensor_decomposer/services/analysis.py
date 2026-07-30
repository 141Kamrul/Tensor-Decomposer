from __future__ import annotations

from typing import Any, Iterable

import numpy as np

from .algorithms import run_algorithm
from .tensor_utils import count_parameters, reconstruct_cp, reconstruct_tt, reconstruct_tucker


def analyze_decomposition(array: np.ndarray, algorithm: str, result: dict[str, Any]) -> dict[str, Any]:
    tensor = np.asarray(array, dtype=float)
    reconstructed = reconstruct_tensor(algorithm, result)
    absolute_error = float(np.linalg.norm(tensor - reconstructed))
    relative_error = float(absolute_error / (np.linalg.norm(tensor) + 1e-12))
    compressed_parameters = count_compressed_parameters(algorithm, result)
    original_parameters = int(tensor.size)

    return {
        "algorithm": algorithm,
        "original_parameters": original_parameters,
        "compressed_parameters": compressed_parameters,
        "compression_ratio": round(float(original_parameters / max(1, compressed_parameters)), 3),
        "absolute_error": round(absolute_error, 6),
        "relative_error": round(relative_error, 6),
    }


def compare_methods(array: np.ndarray, algorithms: Iterable[str]) -> list[dict[str, Any]]:
    comparison: list[dict[str, Any]] = []
    for algorithm in algorithms:
        result = run_algorithm(array, algorithm)
        analysis = analyze_decomposition(array, algorithm, result)
        comparison.append(
            {
                "algorithm": algorithm,
                "compression_ratio": analysis["compression_ratio"],
                "relative_error": analysis["relative_error"],
                "compressed_parameters": analysis["compressed_parameters"],
            }
        )

    return comparison


def reconstruct_tensor(algorithm: str, result: dict[str, Any]) -> np.ndarray:
    if algorithm == "cp":
        return reconstruct_cp(result["weights"], result["factors"])

    if algorithm == "tucker":
        return reconstruct_tucker(result["core"], result["factors"])

    if algorithm == "hosvd":
        return reconstruct_tucker(result["core"], result["factors"])

    if algorithm == "tensor_train":
        return reconstruct_tt(result["cores"])

    if algorithm == "svd":
        return result["u"] @ np.diag(result["singular_values"]) @ result["vh"]

    if algorithm == "eigendecomposition":
        return result["eigenvectors"] @ np.diag(result["eigenvalues"]) @ np.linalg.inv(result["eigenvectors"])

    if algorithm == "qr":
        return result["q"] @ result["r"]

    if algorithm == "lu":
        return result["l"] @ result["u"]

    raise ValueError(f"Unsupported algorithm while reconstructing tensor: {algorithm}")


def count_compressed_parameters(algorithm: str, result: dict[str, Any]) -> int:
    if algorithm == "cp":
        return int(np.prod(result["weights"].shape)) + count_parameters(result["factors"])

    if algorithm in {"tucker", "hosvd"}:
        return int(np.prod(result["core"].shape)) + count_parameters(result["factors"])

    if algorithm == "tensor_train":
        return count_parameters(result["cores"])

    if algorithm == "svd":
        return int(np.prod(result["u"].shape)) + int(np.prod(result["singular_values"].shape)) + int(np.prod(result["vh"].shape))

    if algorithm == "eigendecomposition":
        return int(np.prod(result["eigenvectors"].shape)) + int(np.prod(result["eigenvalues"].shape))

    if algorithm == "qr":
        return int(np.prod(result["q"].shape)) + int(np.prod(result["r"].shape))

    if algorithm == "lu":
        return int(np.prod(result["l"].shape)) + int(np.prod(result["u"].shape))

    raise ValueError(f"Unsupported algorithm while counting compressed parameters: {algorithm}")