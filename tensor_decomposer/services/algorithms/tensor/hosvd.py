from __future__ import annotations

from typing import Any

import numpy as np

from ...function.tensor_utils import as_float_tensor, matricization, mode_n_product
from ..matrix.svd import svd


def hosvd(array: np.ndarray, ranks: list[int] | None = None) -> dict[str, Any]:
    """Higher-Order Singular Value Decomposition (HOSVD).

    As formulated in Kolda & Bader (2009) [Section 4.2] and De Lathauwer et al. (2000),
    HOSVD is a multilinear generalization of matrix SVD for N-way tensors.

    It computes the leading left singular vectors of each mode-n matrix unfolding X_(n)
    to form orthonormal factor matrices A^(n) and an all-orthogonal core tensor G.

    Args:
        array: Input tensor as a NumPy array (ndim >= 2).
        ranks: Optional target ranks [R_1, R_2, ..., R_N] for truncated HOSVD.
            If None, full ranks [I_1, I_2, ..., I_N] are used.

    Returns:
        dict containing:
            - "method": "hosvd"
            - "core": core tensor G
            - "factors": list of orthonormal factor matrices [A^(1), ..., A^(N)]
            - "singular_values": list of mode-n singular values
            - "ranks": list of ranks used along each mode
            - "shape": original tensor shape
    """
    tensor = as_float_tensor(array)
    if tensor.ndim < 2:
        raise ValueError("HOSVD requires a tensor with at least 2 dimensions")

    ndim = tensor.ndim
    if ranks is not None:
        if len(ranks) != ndim:
            raise ValueError(
                f"Length of ranks list ({len(ranks)}) must match tensor dimensions ({ndim})"
            )
        for mode, (r, dim) in enumerate(zip(ranks, tensor.shape)):
            if r < 1 or r > dim:
                raise ValueError(
                    f"Rank for mode {mode} must be between 1 and {dim}, got {r}"
                )

    factors: list[np.ndarray] = []
    singular_values: list[np.ndarray] = []
    actual_ranks: list[int] = []

    for mode in range(ndim):
        unfolding = matricization(tensor, mode)
        svd_res = svd(unfolding)
        u, s = svd_res["u"], svd_res["singular_values"]

        target_rank = ranks[mode] if ranks is not None else u.shape[1]
        target_rank = min(target_rank, u.shape[1])

        factors.append(u[:, :target_rank])
        singular_values.append(s)
        actual_ranks.append(target_rank)

    core = tensor
    for mode, factor in enumerate(factors):
        core = mode_n_product(core, factor.T, mode)

    return {
        "method": "hosvd",
        "core": core,
        "factors": factors,
        "singular_values": singular_values,
        "ranks": actual_ranks,
        "shape": tensor.shape,
    }