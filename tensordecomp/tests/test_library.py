import numpy as np
import pytest

import tensordecomp as td


def test_library_exports():
    expected_exports = [
        "cp",
        "tucker",
        "hosvd",
        "tensor_train",
        "cp_puzzle",
        "tucker_puzzle",
        "hosvd_puzzle",
        "tensor_train_puzzle",
        "puzzle_tensor",
        "invert_puzzle_tensor",
        "analyze_decomposition",
        "compare_methods",
        "benchmark_algorithm",
        "reconstruct_tensor",
        "parse_tensor_input",
    ]
    for export_name in expected_exports:
        assert hasattr(td, export_name), f"Missing export: {export_name}"


def test_parse_tensor_input():
    arr = td.parse_tensor_input("[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]")
    assert arr.shape == (2, 2, 2)
    assert arr[0, 1, 0] == 3.0


def test_cp_decomposition():
    tensor = np.arange(24, dtype=float).reshape(2, 3, 4)
    result = td.cp(tensor, rank=2)
    assert result["method"] == "cp"
    assert len(result["factors"]) == 3
    assert result["factors"][0].shape == (2, 2)
    assert result["factors"][1].shape == (3, 2)
    assert result["factors"][2].shape == (4, 2)


def test_tucker_decomposition():
    tensor = np.arange(24, dtype=float).reshape(2, 3, 4)
    result = td.tucker(tensor, ranks=[2, 2, 2])
    assert result["method"] == "tucker"
    assert result["core"].shape == (2, 2, 2)
    assert len(result["factors"]) == 3


def test_hosvd_and_reconstruction():
    tensor = np.arange(24, dtype=float).reshape(2, 3, 4)
    result = td.hosvd(tensor)
    assert result["method"] == "hosvd"
    reconstructed = td.reconstruct_tensor("hosvd", result)
    assert reconstructed.shape == tensor.shape
    np.testing.assert_allclose(reconstructed, tensor, rtol=1e-4, atol=1e-4)


def test_tensor_train():
    tensor = np.arange(24, dtype=float).reshape(2, 3, 4)
    result = td.tensor_train(tensor, max_rank=3)
    assert result["method"] == "tensor_train"
    assert len(result["cores"]) == 3
    reconstructed = td.reconstruct_tensor("tensor_train", result)
    assert reconstructed.shape == tensor.shape


def test_puzzle_tensor_roundtrip():
    tensor = np.arange(24, dtype=float).reshape(2, 3, 4)
    shifted, shifts = td.puzzle_tensor(tensor, max_shift=2, max_iter=3, return_shifts=True)
    assert shifted.shape == tensor.shape
    restored = td.invert_puzzle_tensor(shifted, shifts)
    np.testing.assert_allclose(restored, tensor, rtol=1e-5, atol=1e-5)


def test_puzzle_augmented_methods():
    tensor = np.arange(24, dtype=float).reshape(2, 3, 4)
    algos = ["cp_puzzle", "tucker_puzzle", "hosvd_puzzle", "tensor_train_puzzle"]
    for algo in algos:
        result = td.run_algorithm(tensor, algo)
        assert result["method"] == algo
        assert "shifts" in result
        assert result.get("is_puzzle") is True
        analysis = td.analyze_decomposition(tensor, algo, result)
        assert analysis["compression_ratio"] > 0
        assert "root_mean_squared_error" in analysis


def test_compare_methods():
    tensor = np.arange(24, dtype=float).reshape(2, 3, 4)
    comp = td.compare_methods(tensor, ["cp", "tucker", "hosvd", "tensor_train"])
    assert len(comp) == 4
    for row in comp:
        assert "compression_ratio" in row
        assert "relative_error" in row
        assert "execution_time_ms" in row
