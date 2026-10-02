from __future__ import annotations

from typing import Any

import numpy as np

from ...function.tensor_utils import as_float_tensor, norm
from ..matrix.svd import svd


def tensor_train(
    array: np.ndarray,
    ranks: list[int] | None = None,
    max_rank: int | None = 4,
    tol: float | None = None,
) -> dict[str, Any]:
    """Tensor-Train (TT) Decomposition via TT-SVD algorithm.

    As introduced by I. V. Oseledets (2011) [SIAM J. Sci. Comput., 33(5), 2295-2317],
    TT-SVD decomposes an N-dimensional tensor A into a sequence of 3D core tensors
    G_1, G_2, ..., G_d such that:
        A(i_1, i_2, ..., i_d) = G_1(i_1) * G_2(i_2) * ... * G_d(i_d)

    The algorithm computes sequential SVDs of auxiliary matrix unfoldings.

    Args:
        array: Input tensor as a NumPy array (ndim >= 2).
        ranks: Optional explicit target TT-ranks [r_1, r_2, ..., r_{d-1}].
        max_rank: Maximum TT-rank bound r_k if ranks is None. Default is 4.
        tol: Relative error threshold epsilon. Truncates singular values according to
            delta = (epsilon / sqrt(d - 1)) * ||A||_F as in Oseledets (2011) Algorithm 1.

    Returns:
        dict containing:
            - "method": "tensor_train"
            - "cores": list of 3D core tensors G_1, G_2, ..., G_d
            - "ranks": list of TT-ranks [r_0=1, r_1, ..., r_{d-1}, r_d=1]
            - "singular_values": list of singular value arrays at each SVD step
            - "shape": original tensor shape
    """
    tensor = as_float_tensor(array)
    if tensor.ndim < 2:
        raise ValueError("Tensor Train decomposition requires a tensor with at least 2 dimensions")

    ndim = tensor.ndim
    if ranks is not None:
        if len(ranks) != ndim - 1:
            raise ValueError(
                f"Length of ranks list ({len(ranks)}) must be ndim - 1 ({ndim - 1})"
            )
        for idx, r in enumerate(ranks):
            if r < 1:
                raise ValueError(f"TT-rank at index {idx} must be >= 1, got {r}")

    tensor_norm = float(norm(tensor))
    delta = 0.0
    if tol is not None and ndim > 1 and tensor_norm > 0:
        delta = (tol / np.sqrt(ndim - 1)) * tensor_norm

    cores: list[np.ndarray] = []
    singular_values_list: list[np.ndarray] = []
    tt_ranks: list[int] = [1]

    unfolding = tensor
    rank_prev = 1

    for mode in range(ndim - 1):
        n_k = tensor.shape[mode]
        unfolding = unfolding.reshape(rank_prev * n_k, -1)
        svd_res = svd(unfolding)
        u, s, vh = svd_res["u"], svd_res["singular_values"], svd_res["vh"]

        singular_values_list.append(s)

        # Determine TT-rank r_k
        if ranks is not None:
            rk = ranks[mode]
        elif tol is not None and delta > 0:
            rk = int(np.sum(s > delta))
            rk = max(1, rk)
        else:
            rk = u.shape[1]

        if ranks is None and max_rank is not None:
            rk = min(rk, max_rank)

        rk = max(1, min(rk, u.shape[1]))
        tt_ranks.append(rk)

        u_trunc = u[:, :rk]
        s_trunc = s[:rk]
        vh_trunc = vh[:rk, :]

        core = u_trunc.reshape(rank_prev, n_k, rk)
        cores.append(core)

        unfolding = np.diag(s_trunc) @ vh_trunc
        rank_prev = rk

    final_core = unfolding.reshape(rank_prev, tensor.shape[-1], 1)
    cores.append(final_core)
    tt_ranks.append(1)

    return {
        "method": "tensor_train",
        "cores": cores,
        "ranks": tt_ranks,
        "singular_values": singular_values_list,
        "shape": tensor.shape,
    }