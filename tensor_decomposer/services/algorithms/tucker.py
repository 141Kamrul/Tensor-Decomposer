from __future__ import annotations

from typing import Any

import numpy as np

from ..tensor_utils import as_float_tensor, mode_n_product, unfold_tensor


def tucker(array: np.ndarray) -> dict[str, Any]:
    tensor = as_float_tensor(array)
    if tensor.ndim < 2:
        raise ValueError("Tucker decomposition requires a tensor with at least 2 dimensions")

    factors: list[np.ndarray] = []
    ranks: list[int] = []
    for mode in range(tensor.ndim):
        unfolding = unfold_tensor(tensor, mode)
        u, _, _ = np.linalg.svd(unfolding, full_matrices=False)
        rank = max(1, min(u.shape[1], max(1, tensor.shape[mode] // 2)))
        factors.append(u[:, :rank])
        ranks.append(rank)

    core = tensor
    for mode, factor in enumerate(factors):
        core = mode_n_product(core, factor.T, mode)

    return {
        "method": "tucker",
        "core": core,
        "factors": factors,
        "ranks": ranks,
        "shape": tensor.shape,
    }