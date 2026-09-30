from __future__ import annotations

from typing import Any

import numpy as np

from .matrix.lu import lu
from .tensor.cp import cp
from .matrix.eigendecomposition import eigendecomposition
from .tensor.hosvd import hosvd
from .matrix.qr import qr
from .tensor.tensor_train import tensor_train
from .tensor.tucker import tucker
from .matrix.svd import svd

SUPPORTED_ALGORITHMS: tuple[str, ...] = (
    "cp",
    "tucker",
    "hosvd",
    "tensor_train",
    "svd",
    "eigendecomposition",
    "qr",
    "lu",
)


def run_algorithm(array: np.ndarray, algorithm: str, **kwargs: Any) -> dict[str, Any]:
    if algorithm == "cp":
        return cp(array, **kwargs)

    if algorithm == "tucker":
        return tucker(array, **kwargs)

    if algorithm == "hosvd":
        return hosvd(array, **kwargs)

    if algorithm == "tensor_train":
        return tensor_train(array, **kwargs)

    if algorithm == "svd":
        return svd(array, **kwargs)

    if algorithm == "eigendecomposition":
        return eigendecomposition(array, **kwargs)

    if algorithm == "qr":
        return qr(array, **kwargs)

    if algorithm == "lu":
        return lu(array, **kwargs)

    raise ValueError(f"Unsupported algorithm while running: {algorithm}")