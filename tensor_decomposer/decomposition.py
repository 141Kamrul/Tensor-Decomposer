from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import numpy as np

from .services.algorithms import run_algorithm


import ast
import re


def parse_tensor_input(raw_value: str) -> np.ndarray:
    text = (raw_value or "").strip()
    if not text:
        raise ValueError("Tensor input is empty")

    # 1. Direct JSON parse
    try:
        data = json.loads(text)
        return np.asarray(data, dtype=float)
    except (json.JSONDecodeError, ValueError):
        pass

    # 2. Direct Python literal_eval (handles trailing commas, tuples, Python numbers)
    try:
        data = ast.literal_eval(text)
        return np.asarray(data, dtype=float)
    except (ValueError, SyntaxError):
        pass

    # 3. Extract bracketed tensor content [...]
    # Handles files/inputs containing shape headers or metadata above the tensor (e.g., "3\n2\n4\n1\n[[[[...]]]]")
    first_bracket = text.find("[")
    last_bracket = text.rfind("]")
    if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
        bracket_content = text[first_bracket : last_bracket + 1].strip()

        # Try JSON on bracket content
        try:
            data = json.loads(bracket_content)
            return np.asarray(data, dtype=float)
        except (json.JSONDecodeError, ValueError):
            pass

        # Try ast.literal_eval on bracket content
        try:
            data = ast.literal_eval(bracket_content)
            return np.asarray(data, dtype=float)
        except (ValueError, SyntaxError):
            pass

        # Strip trailing commas before closing brackets: e.g. [1, 2,] -> [1, 2]
        cleaned_brackets = re.sub(r",\s*([\]\}])", r"\1", bracket_content)
        try:
            data = json.loads(cleaned_brackets)
            return np.asarray(data, dtype=float)
        except (json.JSONDecodeError, ValueError):
            pass
        try:
            data = ast.literal_eval(cleaned_brackets)
            return np.asarray(data, dtype=float)
        except (ValueError, SyntaxError):
            pass

        # Handle numpy-style bracketed formatting without commas: e.g. "[[ 1  2] [ 3  4]]"
        np_formatted = re.sub(r"(?<=[0-9eE\.\+\-])\s+(?=[0-9eE\.\+\-])", ", ", cleaned_brackets)
        np_formatted = re.sub(r"(?<=\])\s+(?=\[)", ", ", np_formatted)
        try:
            data = json.loads(np_formatted)
            return np.asarray(data, dtype=float)
        except (json.JSONDecodeError, ValueError):
            pass
        try:
            data = ast.literal_eval(np_formatted)
            return np.asarray(data, dtype=float)
        except (ValueError, SyntaxError):
            pass

    # 4. Dense flat numbers with potential shape headers
    tokens = text.replace(",", " ").replace("[", " ").replace("]", " ").split()
    if tokens:
        try:
            all_numbers = [float(t) for t in tokens]
        except ValueError as exc:
            raise ValueError(f"Invalid tensor format: {exc}") from exc

        # Check if text before first bracket provided explicit shape
        if first_bracket != -1:
            header_text = text[:first_bracket].strip()
            header_tokens = header_text.split()
            try:
                shape_dims = [int(t) for t in header_tokens]
                prod = int(np.prod(shape_dims))
                val_tokens = text[first_bracket:].replace(",", " ").replace("[", " ").replace("]", " ").split()
                vals = [float(t) for t in val_tokens]
                if len(vals) == prod:
                    return np.array(vals, dtype=float).reshape(shape_dims)
            except Exception:
                pass

        return np.array(all_numbers, dtype=float).reshape(-1, 1)

    raise ValueError("Could not parse tensor from the provided input.")


def run_decomposition(array: np.ndarray, algorithm: str, **kwargs: Any) -> dict[str, Any]:
    return run_algorithm(array, algorithm, **kwargs)


def export_result(result: dict[str, Any], filename: str = "decomposition_result.json", output_dir: str | Path | None = None) -> Path:
    if os.environ.get("VERCEL"):
        target_dir = Path("/tmp/results")
    else:
        target_dir = Path(output_dir or "results")

    target_dir.mkdir(parents=True, exist_ok=True)

    export_path = target_dir / filename
    export_path.write_text(json.dumps(result, default=_json_default), encoding="utf-8")
    return export_path


def _json_default(value: Any) -> Any:
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")
