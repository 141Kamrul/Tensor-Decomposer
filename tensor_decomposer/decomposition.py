from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from .services.algorithms import run_algorithm


def parse_tensor_input(raw_value: str) -> np.ndarray:
    text = (raw_value or "").strip()
    if not text:
        raise ValueError("Tensor input is empty")

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = np.array([float(part) for part in text.replace("[", " ").replace("]", " ").split()])
        return data.reshape(-1, 1)

    return np.asarray(data, dtype=float)


def run_decomposition(array: np.ndarray, algorithm: str) -> dict[str, Any]:
    return run_algorithm(array, algorithm)


def export_result(result: dict[str, Any], output_dir: str | Path | None = None) -> Path:
    target_dir = Path(output_dir or "results")
    target_dir.mkdir(parents=True, exist_ok=True)

    export_path = target_dir / "decomposition_result.json"
    export_path.write_text(json.dumps(result, default=_json_default), encoding="utf-8")
    return export_path


def _json_default(value: Any) -> Any:
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")
