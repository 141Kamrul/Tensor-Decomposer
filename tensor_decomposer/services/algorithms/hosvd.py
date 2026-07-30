from __future__ import annotations

from typing import Any

import numpy as np

from ..tensor_utils import as_float_tensor, mode_n_product, unfold_tensor


def hosvd(array: np.ndarray) -> dict[str, Any]:
    tensor = as_float_tensor(array)
    if tensor.ndim < 2:
        raise ValueError("HOSVD requires a tensor with at least 2 dimensions")

    factors: list[np.ndarray] = []
    for mode in range(tensor.ndim):
        unfolding = unfold_tensor(tensor, mode)
        u, _, _ = np.linalg.svd(unfolding, full_matrices=False)
        factors.append(u)

    core = tensor
    for mode, factor in enumerate(factors):
        core = mode_n_product(core, factor.T, mode)

    return {
        "method": "hosvd",
        "core": core,
        "factors": factors,
        "shape": tensor.shape,
    }