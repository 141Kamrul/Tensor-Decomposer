import json
import numpy as np
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, SimpleTestCase

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


class InputValidationEdgeCaseTests(SimpleTestCase):
    def test_alphabets_in_input_raises_value_error(self):
        alphabet_cases = [
            "abc",
            "hello world",
            "[1, 2, 'hello']",
            "[[1, 2], [three, 4]]",
            "[[1.0, 2.0], [\"abc\", 4.0]]",
            "1a 2b 3c",
        ]
        for raw in alphabet_cases:
            with self.subTest(input_text=raw):
                with self.assertRaises(ValueError) as ctx:
                    parse_tensor_input(raw)
                self.assertIn("could not convert string to float", str(ctx.exception))

    def test_incomplete_and_unbalanced_brackets_raises_value_error(self):
        unbalanced_cases = [
            "[1, 2,",
            "[[1, 2], [3, 4",
            "[[1, 2], [3, 4]]]",
            "[[[1, 2]]",
            "[1, 2]]",
        ]
        for raw in unbalanced_cases:
            with self.subTest(input_text=raw):
                with self.assertRaises(ValueError) as ctx:
                    parse_tensor_input(raw)
                self.assertIn("unclosed or unbalanced brackets", str(ctx.exception))

    def test_ragged_inhomogeneous_tensor_raises_value_error(self):
        ragged_cases = [
            "[[1, 2], [3]]",
            "[[[1, 2]], [[3, 4, 5]]]",
            "[[1, 2, 3], [4, 5]]",
        ]
        for raw in ragged_cases:
            with self.subTest(input_text=raw):
                with self.assertRaises(ValueError) as ctx:
                    parse_tensor_input(raw)
                self.assertIn("Incomplete or ragged tensor input", str(ctx.exception))

    def test_empty_and_scalar_inputs_raise_value_error(self):
        empty_or_scalar = ["", "   ", "\n\t", "[]", "[[]]", "42", "null", "None"]
        for raw in empty_or_scalar:
            with self.subTest(input_text=raw):
                with self.assertRaises(ValueError):
                    parse_tensor_input(raw)


class HighDimensionalTensorTests(SimpleTestCase):
    def test_5d_tensor_cp_decomposition(self):
        # 5-way tensor: shape (2, 2, 2, 2, 2)
        tensor = np.arange(32, dtype=float).reshape(2, 2, 2, 2, 2)
        result = run_decomposition(tensor, "cp", rank=2)

        self.assertEqual(result["method"], "cp")
        self.assertEqual(result["rank"], 2)
        self.assertEqual(len(result["factors"]), 5)
        for factor in result["factors"]:
            self.assertEqual(factor.shape, (2, 2))
        self.assertEqual(result["shape"], [2, 2, 2, 2, 2])
        self.assertEqual(result["min_rank"], 1)
        self.assertEqual(result["max_rank"], 32)

    def test_5d_tensor_tensor_train_decomposition(self):
        tensor = np.arange(32, dtype=float).reshape(2, 2, 2, 2, 2)
        result = run_decomposition(tensor, "tensor_train", ranks=[2, 2, 2, 2])

        self.assertEqual(result["method"], "tensor_train")
        self.assertEqual(len(result["cores"]), 5)
        self.assertEqual(result["shape"], [2, 2, 2, 2, 2])
        for core in result["cores"]:
            self.assertEqual(core.ndim, 3)
        self.assertEqual(result["ranks"], [1, 2, 2, 2, 2, 1])

        # Exact / low error reconstruction check
        from tensor_decomposer.services.function.analysis import reconstruct_tensor
        reconstructed = reconstruct_tensor("tensor_train", result)
        analysis = analyze_decomposition(tensor, "tensor_train", result)
        self.assertLess(analysis["relative_error"], 0.2)

    def test_5d_tensor_tucker_and_hosvd_decomposition(self):
        tensor = np.arange(32, dtype=float).reshape(2, 2, 2, 2, 2)
        ranks = [2, 2, 2, 2, 2]

        tucker_res = run_decomposition(tensor, "tucker", ranks=ranks)
        self.assertEqual(tucker_res["method"], "tucker")
        self.assertEqual(tucker_res["core"].ndim, 5)
        self.assertEqual(len(tucker_res["factors"]), 5)
        self.assertEqual(tucker_res["ranks"], ranks)

        hosvd_res = run_decomposition(tensor, "hosvd", ranks=ranks)
        self.assertEqual(hosvd_res["method"], "hosvd")
        self.assertEqual(hosvd_res["core"].ndim, 5)
        self.assertEqual(len(hosvd_res["factors"]), 5)
        self.assertEqual(hosvd_res["ranks"], ranks)

    def test_6d_tensor_with_singletons(self):
        tensor = np.arange(16, dtype=float).reshape(2, 1, 2, 1, 2, 2)
        tt_res = run_decomposition(tensor, "tensor_train")
        self.assertEqual(len(tt_res["cores"]), 6)
        self.assertEqual(tt_res["shape"], [2, 1, 2, 1, 2, 2])

        hosvd_res = run_decomposition(tensor, "hosvd")
        self.assertEqual(len(hosvd_res["factors"]), 6)
        self.assertEqual(hosvd_res["shape"], [2, 1, 2, 1, 2, 2])

    def test_1d_and_0d_tensors_rejected_by_algorithms(self):
        array_1d = np.array([1.0, 2.0, 3.0])
        scalar_0d = np.array(42.0)
        algos = ["cp", "tucker", "hosvd", "tensor_train"]

        for algo in algos:
            with self.subTest(algorithm=algo, ndim=1):
                with self.assertRaises(ValueError) as ctx:
                    run_decomposition(array_1d, algo)
                self.assertIn("requires a tensor with at least 2 dimensions", str(ctx.exception))

            with self.subTest(algorithm=algo, ndim=0):
                with self.assertRaises(ValueError) as ctx:
                    run_decomposition(scalar_0d, algo)
                self.assertIn("requires a tensor with at least 2 dimensions", str(ctx.exception))


class NumericalEdgeCaseTests(SimpleTestCase):
    def test_all_zero_tensor_safe_execution(self):
        zero_tensor = np.zeros((3, 3, 3), dtype=float)
        algos = ["cp", "tucker", "hosvd", "tensor_train"]

        for algo in algos:
            with self.subTest(algorithm=algo):
                res = run_decomposition(zero_tensor, algo)
                analysis = analyze_decomposition(zero_tensor, algo, res)
                self.assertEqual(analysis["absolute_error"], 0.0)
                self.assertEqual(analysis["relative_error"], 0.0)
                self.assertEqual(analysis["mean_absolute_error"], 0.0)
                self.assertEqual(analysis["root_mean_squared_error"], 0.0)

    def test_singleton_dimensions(self):
        # Matrix embedded in a 3D tensor: (1, 4, 1)
        tensor = np.arange(4, dtype=float).reshape(1, 4, 1)
        cp_res = run_decomposition(tensor, "cp", rank=1)
        self.assertEqual(len(cp_res["factors"]), 3)
        self.assertEqual(cp_res["factors"][0].shape, (1, 1))
        self.assertEqual(cp_res["factors"][1].shape, (4, 1))
        self.assertEqual(cp_res["factors"][2].shape, (1, 1))

        # (4, 1, 3, 1) 4D tensor
        tensor4d = np.random.randn(4, 1, 3, 1)
        tt_res = run_decomposition(tensor4d, "tensor_train")
        self.assertEqual(len(tt_res["cores"]), 4)

    def test_extreme_and_negative_ranks_clamped(self):
        tensor = np.arange(8, dtype=float).reshape(2, 2, 2)

        # CP negative/zero rank clamped to 1
        cp_neg = run_decomposition(tensor, "cp", rank=-5)
        self.assertEqual(cp_neg["rank"], 1)

        # CP excessively large rank clamped to total elements / 50
        cp_large = run_decomposition(tensor, "cp", rank=999)
        self.assertEqual(cp_large["rank"], 8)

        # Tucker mode ranks clamped to mode sizes
        tucker_large = run_decomposition(tensor, "tucker", ranks=[10, 20, 30])
        self.assertEqual(tucker_large["ranks"], [2, 2, 2])

        # TT interior bond ranks clamped to max possible bond rank
        tt_large = run_decomposition(tensor, "tensor_train", ranks=[50, 50])
        self.assertEqual(tt_large["ranks"], [1, 2, 2, 1])

    def test_nonexistent_algorithm_raises_value_error(self):
        tensor = np.arange(8, dtype=float).reshape(2, 2, 2)
        with self.assertRaises(ValueError) as ctx:
            run_decomposition(tensor, "completely_unknown_algo")
        self.assertIn("Unsupported algorithm", str(ctx.exception))


class UIViewIntegrationTests(SimpleTestCase):
    def setUp(self):
        self.client = Client()

    def test_ui_home_get_request(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("algorithm_options", response.context)
        self.assertIn("tensor_methods", response.context)
        self.assertIn("puzzle_methods", response.context)
        self.assertContains(response, "Tensor Decomposer")

    def test_ui_post_decompose_valid(self):
        response = self.client.post(
            "/",
            {
                "tensor_input": "[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]",
                "algorithm": "cp",
                "action": "decompose",
                "ranks_input": "2",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("result", response.context)
        self.assertIn("analysis", response.context)
        self.assertIn("download_url", response.context)
        self.assertEqual(response.context["result"]["rank"], 2)

    def test_ui_ajax_post_decompose_valid_json(self):
        response = self.client.post(
            "/",
            {
                "tensor_input": "[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]",
                "algorithm": "tensor_train",
                "action": "decompose",
                "ranks_input": "2, 2",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
        data = json.loads(response.content)
        self.assertIn("result", data)
        self.assertIn("analysis", data)
        self.assertEqual(data["result"]["method"], "tensor_train")

    def test_ui_ajax_post_with_alphabets_returns_400(self):
        response = self.client.post(
            "/",
            {
                "tensor_input": "[[1, 2], [three, 4]]",
                "algorithm": "cp",
                "action": "decompose",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("error", data)
        self.assertIn("could not convert string to float", data["error"])

    def test_ui_ajax_post_with_incomplete_brackets_returns_400(self):
        response = self.client.post(
            "/",
            {
                "tensor_input": "[[1, 2], [3, 4",
                "algorithm": "cp",
                "action": "decompose",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("error", data)
        self.assertIn("unclosed or unbalanced brackets", data["error"])

    def test_ui_file_upload_valid_text_file(self):
        file_content = b"[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]"
        tensor_file = SimpleUploadedFile("tensor.json", file_content, content_type="text/plain")
        response = self.client.post(
            "/",
            {
                "tensor_file": tensor_file,
                "algorithm": "hosvd",
                "action": "decompose",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data["result"]["method"], "hosvd")

    def test_ui_file_upload_unsupported_binary_file_returns_400(self):
        binary_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\xff\xfe\x00\x01"
        tensor_file = SimpleUploadedFile("sample_image.png", binary_content, content_type="image/png")
        response = self.client.post(
            "/",
            {
                "tensor_file": tensor_file,
                "algorithm": "cp",
                "action": "decompose",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("error", data)
        self.assertIn("Unsupported file format for 'sample_image.png'", data["error"])

    def test_ui_actions_benchmark_and_compare(self):
        valid_tensor = "[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]"

        # Benchmark action
        bm_resp = self.client.post(
            "/",
            {"tensor_input": valid_tensor, "algorithm": "cp", "action": "benchmark"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(bm_resp.status_code, 200)
        bm_data = json.loads(bm_resp.content)
        self.assertIn("benchmark", bm_data)
        self.assertIn("flops", bm_data["benchmark"])

        # Compare action
        comp_resp = self.client.post(
            "/",
            {"tensor_input": valid_tensor, "algorithm": "cp", "action": "compare"},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(comp_resp.status_code, 200)
        comp_data = json.loads(comp_resp.content)
        self.assertIn("comparison", comp_data)
        self.assertEqual(len(comp_data["comparison"]), 8)

    def test_ui_ranks_input_parsing(self):
        valid_tensor = "[[[1, 2], [3, 4]], [[5, 6], [7, 8]]]"

        # For CP: entering multiple mode ranks "2, 3, 2" should extract single rank R=2
        resp_cp = self.client.post(
            "/",
            {
                "tensor_input": valid_tensor,
                "algorithm": "cp",
                "action": "decompose",
                "ranks_input": "2, 3, 2",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(resp_cp.status_code, 200)
        data_cp = json.loads(resp_cp.content)
        self.assertEqual(data_cp["result"]["rank"], 2)

        # Invalid rank input text gracefully falls back to auto rank without crashing
        resp_fallback = self.client.post(
            "/",
            {
                "tensor_input": valid_tensor,
                "algorithm": "cp",
                "action": "decompose",
                "ranks_input": "invalid_rank_string",
            },
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(resp_fallback.status_code, 200)
        data_fallback = json.loads(resp_fallback.content)
        self.assertIn("result", data_fallback)




