import numpy as np
from django.test import SimpleTestCase

from tensor_decomposer.decomposition import parse_tensor_input, run_decomposition


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
