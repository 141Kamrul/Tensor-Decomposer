from __future__ import annotations

from typing import Any

import numpy as np

from ...function.tensor_utils import as_float_tensor


def tensor_train(array: np.ndarray, max_rank: int = 4) -> dict[str, Any]:
    tensor = as_float_tensor(array)
    if tensor.ndim < 2:
        raise ValueError("Tensor Train decomposition requires a tensor with at least 2 dimensions")

    cores: list[np.ndarray] = []
    unfolding = tensor
    rank_prev = 1

    for mode in range(tensor.ndim - 1):
        unfolding = unfolding.reshape(rank_prev * tensor.shape[mode], -1)
        u, singular_values, vh = np.linalg.svd(unfolding, full_matrices=False)
        rank = max(1, min(max_rank, u.shape[1]))
        u = u[:, :rank]
        singular_values = singular_values[:rank]
        vh = vh[:rank, :]

        core = u.reshape(rank_prev, tensor.shape[mode], rank)
        cores.append(core)
        unfolding = np.diag(singular_values) @ vh
        rank_prev = rank

    cores.append(unfolding.reshape(rank_prev, tensor.shape[-1], 1))
    return {
        "method": "tensor_train",
        "cores": cores,
        "shape": tensor.shape,
    }