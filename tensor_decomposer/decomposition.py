from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import numpy as np
import tensordecomp as td
from tensordecomp import parse_tensor_input, run_algorithm


def run_decomposition(array: np.ndarray, algorithm: str, **kwargs: Any) -> dict[str, Any]:
    return run_algorithm(array, algorithm, **kwargs)


def export_result(
    result: dict[str, Any],
    filename: str = "decomposition_result.json",
    output_dir: str | Path | None = None,
) -> Path:
    if os.environ.get("VERCEL"):
        target_dir = Path("/tmp/results")
    elif output_dir is not None:
        target_dir = Path(output_dir)
    else:
        try:
            from django.conf import settings

            target_dir = Path(settings.BASE_DIR) / "results"
        except Exception:
            target_dir = Path(__file__).resolve().parent.parent / "results"

    target_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = Path(filename).name
    export_path = target_dir / safe_filename
    export_path.write_text(json.dumps(result, default=_json_default), encoding="utf-8")
    return export_path


def _json_default(value: Any) -> Any:
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")
