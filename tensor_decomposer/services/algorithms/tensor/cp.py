from __future__ import annotations

from typing import Any

import numpy as np

from ...function.tensor_utils import as_float_tensor, khatri_rao, matricization


def cp(
    array: np.ndarray,
    rank: int | None = None,
    max_iter: int = 100,
    tol: float = 1e-7,
) -> dict[str, Any]:

    tensor = as_float_tensor(array)
    if tensor.ndim < 2:
        raise ValueError("CP decomposition requires a tensor with at least 2 dimensions")

    ndim = tensor.ndim
    if rank is None:
        rank = max(1, min(tensor.shape))

    factors: list[np.ndarray] = []
    for mode in range(ndim):
        unfolding = matricization(tensor, mode)
        u, _, _ = np.linalg.svd(unfolding, full_matrices=False)
        if u.shape[1] < rank:
            pad = np.random.randn(u.shape[0], rank - u.shape[1]) * 0.1
            u = np.hstack([u, pad])
        factors.append(u[:, :rank])

    weights = np.ones(rank, dtype=float)

    # CP-ALS Iterations
    prev_weight_sum = float("inf")
    for _ in range(max_iter):
        for n in range(ndim):
            # Compute V = *_{m != n} (A^(m)^T A^(m))
            V = np.ones((rank, rank), dtype=float)
            for m in range(ndim):
                if m != n:
                    V *= (factors[m].T @ factors[m])

            # Khatri-Rao product of factor matrices for modes in reverse order excluding n
            mats = [factors[m] for m in range(ndim - 1, -1, -1) if m != n]
            W = khatri_rao(mats)

            # Unfold tensor at mode n
            X_n = matricization(tensor, n)

            # Solve A_tilde = X_n @ W @ V^\dagger
            V_pinv = np.linalg.pinv(V)
            A_tilde = X_n @ W @ V_pinv

            # Normalize columns of A_tilde and absorb norms into weights vector
            norms = np.linalg.norm(A_tilde, axis=0)
            norms_clean = np.where(norms == 0, 1.0, norms)
            weights = norms
            factors[n] = A_tilde / norms_clean

        # Check convergence
        weight_sum = float(np.sum(weights))
        if abs(prev_weight_sum - weight_sum) < tol:
            break
        prev_weight_sum = weight_sum

    return {
        "method": "cp",
        "weights": weights,
        "factors": factors,
        "shape": tensor.shape,
        "rank": rank,
    }