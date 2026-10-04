import numpy as np
from django.test import SimpleTestCase

from tensor_decomposer.decomposition import parse_tensor_input, run_decomposition
import tensordecomp as td
from tensordecomp import (
    analyze_decomposition,
    benchmark_algorithm,
    compare_methods,
    reconstruct_tensor,
)


class DecompositionTests(SimpleTestCase):
    def test_parse_tensor_input_from_manual_text(self):
        array = parse_tensor_input("[[1, 2], [3, 4]]")
        self.assertEqual(array.shape, (2, 2))
        np.testing.assert_array_equal(array, np.array([[1, 2], [3, 4]]))

    def test_parse_4mode_tensor_with_header(self):
        raw = "3\n2\n4\n1\n[[[[1], [2], [3], [4]], [[5], [6], [7], [8]]], [[[9], [10], [11], [12]], [[13], [14], [15], [16]]], [[[17], [18], [19], [20]], [[21], [22], [23], [24]]]]"
        array = parse_tensor_input(raw)
        self.assertEqual(array.shape, (3, 2, 4, 1))

    def test_parse_tensor_with_trailing_commas(self):
        raw = "[[[[1, 2], [3, 4],],],]"
        array = parse_tensor_input(raw)
        self.assertEqual(array.shape, (1, 1, 2, 2))

    def test_run_svd_decomposition(self):
        array = np.array([[1.0, 2.0], [3.0, 4.0]])
        result = run_decomposition(array, "svd")
        self.assertIn("u", result)
        self.assertIn("singular_values", result)
        self.assertIn("vh", result)
        self.assertEqual(result["u"].shape, (2, 2))
        self.assertEqual(result["singular_values"].shape, (2,))

    def test_run_cp_decomposition(self):
        array = np.arange(8, dtype=float).reshape(2, 2, 2)
        result = run_decomposition(array, "cp")
        self.assertEqual(result["method"], "cp")
        self.assertIn("weights", result)
        self.assertIn("factors", result)
        self.assertEqual(len(result["factors"]), 3)

    def test_analysis_and_benchmark_services(self):
        array = np.arange(8, dtype=float).reshape(2, 2, 2)
        result = run_decomposition(array, "hosvd")
        analysis = analyze_decomposition(array, "hosvd", result)
        benchmark = benchmark_algorithm(array, "hosvd", repeats=2)

        self.assertIn("compression_ratio", analysis)
        self.assertIn("relative_error", analysis)
        self.assertIn("mean_absolute_error", analysis)
        self.assertIn("root_mean_squared_error", analysis)
        self.assertIn("reconstructed_head", analysis)
        self.assertGreater(analysis["compression_ratio"], 0)
        self.assertIn("execution_time_ms", benchmark)
        self.assertEqual(benchmark["repeats"], 2)

    def test_compare_methods_service(self):
        array = np.arange(8, dtype=float).reshape(2, 2, 2)
        comparison = compare_methods(array, ["cp", "hosvd"])
        self.assertEqual(len(comparison), 2)
        for row in comparison:
            self.assertIn("algorithm", row)
            self.assertIn("compression_ratio", row)
            self.assertIn("relative_error", row)
            self.assertIn("mean_absolute_error", row)
            self.assertIn("root_mean_squared_error", row)
            self.assertIn("execution_time_ms", row)
            self.assertIn("flops", row)

    def test_run_hosvd_decomposition(self):
        rng = np.random.default_rng(42)
        tensor = rng.normal(size=(3, 4, 2))
        result = run_decomposition(tensor, "hosvd")

        self.assertEqual(result["method"], "hosvd")
        self.assertIn("core", result)
        self.assertIn("factors", result)
        self.assertIn("singular_values", result)
        self.assertEqual(len(result["factors"]), 3)
        self.assertEqual(len(result["singular_values"]), 3)

        # 1. Exact reconstruction check (for full rank HOSVD)
        from tensor_decomposer.services.function.analysis import reconstruct_tensor
        reconstructed = reconstruct_tensor("hosvd", result)
        np.testing.assert_allclose(reconstructed, tensor, atol=1e-6)

        # 2. Orthonormality check for factor matrices: A^(n)T A^(n) = I
        for factor in result["factors"]:
            eye = factor.T @ factor
            np.testing.assert_allclose(eye, np.eye(factor.shape[1]), atol=1e-6)

        # 3. Core tensor all-orthogonality check: slices along mode 0 are orthogonal
        core = result["core"]
        slice0 = core[0, :, :]
        slice1 = core[1, :, :]
        dot_prod = np.sum(slice0 * slice1)
        self.assertAlmostEqual(dot_prod, 0.0, places=5)

    def test_truncated_hosvd(self):
        rng = np.random.default_rng(42)
        tensor = rng.normal(size=(4, 5, 3))
        ranks = [2, 3, 2]
        result = run_decomposition(tensor, "hosvd", ranks=ranks)

        self.assertEqual(result["ranks"], ranks)
        self.assertEqual(result["core"].shape, (2, 3, 2))
        self.assertEqual(result["factors"][0].shape, (4, 2))
        self.assertEqual(result["factors"][1].shape, (5, 3))
        self.assertEqual(result["factors"][2].shape, (3, 2))

    def test_run_tensor_train_decomposition(self):
        rng = np.random.default_rng(42)
        tensor = rng.normal(size=(3, 4, 2))
        
        # Test full rank / exact TT reconstruction
        result = run_decomposition(tensor, "tensor_train", max_rank=None)
        self.assertEqual(result["method"], "tensor_train")
        self.assertIn("cores", result)
        self.assertIn("ranks", result)
        self.assertEqual(len(result["cores"]), 3)

        from tensor_decomposer.services.function.analysis import reconstruct_tensor
        reconstructed = reconstruct_tensor("tensor_train", result)
        np.testing.assert_allclose(reconstructed, tensor, atol=1e-6)

        # Test rank-bounded TT-SVD
        result_bounded = run_decomposition(tensor, "tensor_train", max_rank=2)
        for r in result_bounded["ranks"]:
            self.assertLessEqual(r, 2)

        # Test explicit ranks list
        result_explicit = run_decomposition(tensor, "tensor_train", ranks=[2, 2])
        self.assertEqual(result_explicit["ranks"], [1, 2, 2, 1])
        self.assertEqual(result_explicit["cores"][0].shape, (1, 3, 2))
        self.assertEqual(result_explicit["cores"][1].shape, (2, 4, 2))
        self.assertEqual(result_explicit["cores"][2].shape, (2, 2, 1))

    def test_puzzle_tensor_transformation_and_inversion(self):
        from tensor_decomposer.services.function.puzzle_tensor import (
            puzzle_tensor,
            invert_puzzle_tensor,
            tensor_nuclear_norm_loss,
        )

        # 1. Test staggered diagonal matrix (rank-3 -> rank-1 structure)
        diag_matrix = np.eye(5) * 10.0
        orig_loss = tensor_nuclear_norm_loss(diag_matrix)
        shifted_matrix, shifts = puzzle_tensor(diag_matrix, return_shifts=True)
        shifted_loss = tensor_nuclear_norm_loss(shifted_matrix)

        # Nuclear norm loss should be reduced
        self.assertLess(shifted_loss, orig_loss)

        # Inversion must perfectly recover the original matrix
        recovered = invert_puzzle_tensor(shifted_matrix, shifts)
        np.testing.assert_allclose(recovered, diag_matrix, atol=1e-12)

        # 2. Test 3D and 4D tensor transformation and lossless recovery
        tensor_4d = np.random.randn(3, 4, 2, 3)
        shifted_4d, ops = puzzle_tensor(tensor_4d, max_iter=1, max_shift=1, return_shifts=True)
        self.assertEqual(shifted_4d.shape, tensor_4d.shape)
        recovered_4d = invert_puzzle_tensor(shifted_4d, ops)
        np.testing.assert_allclose(recovered_4d, tensor_4d, atol=1e-12)

        # 3. Direct call returning only shifted tensor
        direct_shifted = puzzle_tensor(tensor_4d)
        self.assertIsInstance(direct_shifted, np.ndarray)
        self.assertEqual(direct_shifted.shape, tensor_4d.shape)

    def test_puzzle_augmented_algorithms(self):
        rng = np.random.default_rng(123)
        tensor = rng.normal(size=(3, 3, 3))

        puzzle_algos = ["cp_puzzle", "tucker_puzzle", "hosvd_puzzle", "tensor_train_puzzle"]

        for algo in puzzle_algos:
            with self.subTest(algorithm=algo):
                res = run_decomposition(tensor, algo)
                self.assertTrue(res.get("is_puzzle"))
                self.assertIn("shifts", res)
                self.assertEqual(res["original_shape"], [3, 3, 3])

                # Analyze decomposition
                analysis = analyze_decomposition(tensor, algo, res)
                self.assertIn("compression_ratio", analysis)
                self.assertIn("relative_error", analysis)
                self.assertIn("compressed_parameters", analysis)
                self.assertGreater(analysis["compression_ratio"], 0)

                # Benchmark
                bm = benchmark_algorithm(tensor, algo, repeats=1)
                self.assertIn("flops", bm)
                self.assertIn("flops_str", bm)
                self.assertIn("complexity", bm)

        # Full-rank HOSVD + Puzzle exact reconstruction test
        hosvd_res = run_decomposition(tensor, "hosvd_puzzle")
        from tensor_decomposer.services.function.analysis import reconstruct_tensor
        reconstructed = reconstruct_tensor("hosvd_puzzle", hosvd_res)
        np.testing.assert_allclose(reconstructed, tensor, atol=1e-5)

        # Syntax check for "+" alias: e.g. "cp+puzzle"
        alias_res = run_decomposition(tensor, "cp+puzzle")
        self.assertTrue(alias_res.get("is_puzzle"))
        self.assertEqual(alias_res["method"], "cp_puzzle")



