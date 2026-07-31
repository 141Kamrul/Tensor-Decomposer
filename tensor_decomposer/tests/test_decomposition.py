import numpy as np
from django.test import SimpleTestCase

from tensor_decomposer.decomposition import parse_tensor_input, run_decomposition
from tensor_decomposer.services.analysis import analyze_decomposition, compare_methods
from tensor_decomposer.services.benchmark import benchmark_algorithm


class DecompositionTests(SimpleTestCase):
    def test_parse_tensor_input_from_manual_text(self):
        array = parse_tensor_input("[[1, 2], [3, 4]]")
        self.assertEqual(array.shape, (2, 2))
        np.testing.assert_array_equal(array, np.array([[1, 2], [3, 4]]))

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
