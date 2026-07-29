from __future__ import annotations

from typing import Any

import numpy as np

from .eigendecomposition import eigendecomposition
from .qr import qr
from .svd import svd


def run_algorithm(array: np.ndarray, algorithm: str) -> dict[str, Any]:
    if algorithm == "svd":
        return svd(array)

    if algorithm == "eigendecomposition":
        return eigendecomposition(array)

    if algorithm == "qr":
        return qr(array)

    raise ValueError(f"Unsupported algorithm: {algorithm}")