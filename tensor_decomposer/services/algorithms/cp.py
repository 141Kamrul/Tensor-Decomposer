from __future__ import annotations

from typing import Any

import numpy as np

from ..tensor_utils import as_float_tensor, unfold_tensor


def cp(array: np.ndarray) -> dict[str, Any]:
    tensor = as_float_tensor(array)
    if tensor.ndim < 2:
        raise ValueError("CP decomposition requires a tensor with at least 2 dimensions")

    factors: list[np.ndarray] = []
    for mode in range(tensor.ndim):
        unfolding = unfold_tensor(tensor, mode)
        u, _, _ = np.linalg.svd(unfolding, full_matrices=False)
        factors.append(u[:, :1])

    weights = np.array([np.linalg.norm(tensor)], dtype=float)
    return {
        "method": "cp",
        "weights": weights,
        "factors": factors,
        "shape": tensor.shape,
        "rank": 1,
    }