from __future__ import annotations

from typing import Any

import numpy as np


def eigendecomposition(array: np.ndarray) -> dict[str, Any]:
    eigenvalues, eigenvectors = np.linalg.eig(array)
    return {"eigenvalues": eigenvalues, "eigenvectors": eigenvectors}