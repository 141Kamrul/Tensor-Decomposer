from __future__ import annotations

from typing import Any

import numpy as np

from ...function.tensor_utils import as_float_tensor, mode_n_product, matricization


def tucker(
    array: np.ndarray,
    ranks: list[int] | None = None,
    max_iter: int = 100,
    tol: float = 1e-7,
) -> dict[str, Any]:
    
    tensor = as_float_tensor(array)
    if tensor.ndim < 2:
        raise ValueError("Tucker decomposition requires a tensor with at least 2 dimensions")

    ndim = tensor.ndim
    if ranks is None:
        ranks = [max(1, min(tensor.shape[mode], max(1, tensor.shape[mode] // 2))) for mode in range(ndim)]

    if len(ranks) != ndim:
        raise ValueError(f"Length of ranks list ({len(ranks)}) must match tensor dimensions ({ndim})")

    # Step 1: Initialize factor matrices using HOSVD
    factors: list[np.ndarray] = []
    for mode in range(ndim):
        unfolding = matricization(tensor, mode)
        u, _, _ = np.linalg.svd(unfolding, full_matrices=False)
        target_rank = min(ranks[mode], u.shape[1])
        factors.append(u[:, :target_rank])

    # Step 2: Higher-Order Orthogonal Iteration (HOOI) Loop
    prev_norm = -1.0
    for _ in range(max_iter):
        for n in range(ndim):
            # Compute Y = tensor x_1 A^(1)^T ... x_{n-1} A^(n-1)^T x_{n+1} A^(n+1)^T ... x_N A^(N)^T
            Y = tensor
            for m in range(ndim):
                if m != n:
                    Y = mode_n_product(Y, factors[m].T, m)

            # Unfold Y along mode n and extract leading left singular vectors
            Y_n = matricization(Y, n)
            u, _, _ = np.linalg.svd(Y_n, full_matrices=False)
            factors[n] = u[:, :ranks[n]]

        # Compute core tensor norm for convergence monitoring
        core_test = tensor
        for m in range(ndim):
            core_test = mode_n_product(core_test, factors[m].T, m)
        core_norm = float(np.linalg.norm(core_test))
        if abs(core_norm - prev_norm) < tol:
            break
        prev_norm = core_norm

    # Step 3: Compute final core tensor G = tensor x_1 A^(1)^T ... x_N A^(N)^T
    core = tensor
    for mode, factor in enumerate(factors):
        core = mode_n_product(core, factor.T, mode)

    return {
        "method": "tucker",
        "core": core,
        "factors": factors,
        "shape": tensor.shape,
        "ranks": ranks,
    }