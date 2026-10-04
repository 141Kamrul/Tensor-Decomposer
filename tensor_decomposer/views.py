from __future__ import annotations

import json
from pathlib import Path
import time

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

import tensordecomp as td
from tensordecomp import (
    SUPPORTED_ALGORITHMS,
    analyze_decomposition,
    benchmark_algorithm,
    compare_methods,
    parse_tensor_input,
    run_algorithm,
)

from .decomposition import export_result, run_decomposition


TENSOR_METHODS = ("cp", "tucker", "hosvd", "tensor_train")
PUZZLE_METHODS = ("cp_puzzle", "tucker_puzzle", "hosvd_puzzle", "tensor_train_puzzle")
REFERENCE_METHODS = ("svd", "eigendecomposition", "qr", "lu")
ALGORITHM_LABELS = {
    "cp": "CP Decomposition",
    "cp_puzzle": "CP + PuzzleTensor",
    "tucker": "Tucker Decomposition",
    "tucker_puzzle": "Tucker + PuzzleTensor",
    "hosvd": "Higher Order Singular Value Decomposition",
    "hosvd_puzzle": "HOSVD + PuzzleTensor",
    "tensor_train": "Tensor Train Decomposition",
    "tensor_train_puzzle": "Tensor Train + PuzzleTensor",
    "svd": "SVD",
    "eigendecomposition": "Eigendecomposition",
    "qr": "QR Decomposition",
    "lu": "LU Decomposition",
}


def _pretty_json(value: object) -> str:
    return json.dumps(value, indent=2, default=_json_default)


def _json_default(value: object) -> object:
    if hasattr(value, "tolist"):
        return value.tolist()
    if hasattr(value, "item"):
        return value.item()
    if isinstance(value, complex):
        r, i = value.real, value.imag
        if abs(i) < 1e-12:
            return r
        sign = "+" if i >= 0 else "-"
        abs_i = abs(i)
        if abs(r) < 1e-12:
            return f"{i:.6f}j".lstrip("+")
        return f"{r:.6f}{sign}{abs_i:.6f}j"
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def parse_ranks_input(raw_ranks: str) -> int | list[int] | None:
    text = (raw_ranks or "").strip()
    if not text:
        return None
    cleaned = text.strip("[](){}")
    tokens = [t.strip() for t in cleaned.replace(",", " ").split() if t.strip()]
    if not tokens:
        return None
    try:
        nums = [int(t) for t in tokens]
        if len(nums) == 1:
            return nums[0]
        return nums
    except ValueError:
        return None


def _build_base_context(tensor: object | None, algorithm: str, action: str, ranks_input: str = "") -> dict[str, object]:
    context: dict[str, object] = {
        "algorithm": algorithm,
        "action": action,
        "ranks_input": ranks_input,
        "algorithm_options": SUPPORTED_ALGORITHMS,
        "algorithm_labels": ALGORITHM_LABELS,
        "tensor_methods": TENSOR_METHODS,
        "puzzle_methods": PUZZLE_METHODS,
        "cache_buster": str(int(time.time())),
    }
    if tensor is not None:
        context["tensor"] = tensor
    return context


def home(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        raw_tensor = request.POST.get("tensor_input", "")
        algorithm = request.POST.get("algorithm", "cp")
        action = request.POST.get("action", "decompose")
        ranks_input = request.POST.get("ranks_input", "")
        uploaded_file = request.FILES.get("tensor_file")

        parsed_ranks = parse_ranks_input(ranks_input)
        base_algo = (algorithm or "").lower().replace("+", "_").replace("_puzzle", "")
        # CP requires a single scalar rank R. If a list of mode ranks was entered, extract the single rank integer
        if base_algo == "cp" and parsed_ranks is not None:
            if isinstance(parsed_ranks, list) and len(parsed_ranks) > 0:
                parsed_ranks = parsed_ranks[0]

        algo_kwargs: dict[str, Any] = {}
        if parsed_ranks is not None:
            algo_kwargs["ranks"] = parsed_ranks
            algo_kwargs["rank"] = parsed_ranks

        try:
            if uploaded_file is not None:
                raw_tensor = uploaded_file.read().decode("utf-8")
            tensor = parse_tensor_input(raw_tensor)
            tensor_data = tensor.tolist()

            if action == "benchmark":
                benchmark = benchmark_algorithm(tensor, algorithm, **algo_kwargs)
                export_path = export_result({"tensor": tensor_data, "benchmark": benchmark}, output_dir=Path("results"))
                context = _build_base_context(tensor_data, algorithm, action, ranks_input=ranks_input)
                context.update(
                    {
                        "benchmark": benchmark,
                        "benchmark_json": _pretty_json(benchmark),
                        "download_url": export_path.name,
                    }
                )
                if request.headers.get("x-requested-with") == "XMLHttpRequest":
                    return HttpResponse(json.dumps(context, default=_json_default), content_type="application/json")
                return render(request, "home.html", context)

            if action == "compare":
                methods_to_compare = TENSOR_METHODS + PUZZLE_METHODS
                comparison = compare_methods(tensor, methods_to_compare)
                export_path = export_result({"tensor": tensor_data, "comparison": comparison}, output_dir=Path("results"))
                context = _build_base_context(tensor_data, algorithm, action, ranks_input=ranks_input)
                context.update(
                    {
                        "comparison": comparison,
                        "comparison_json": _pretty_json(comparison),
                        "download_url": export_path.name,
                    }
                )
                if request.headers.get("x-requested-with") == "XMLHttpRequest":
                    return HttpResponse(json.dumps(context, default=_json_default), content_type="application/json")
                return render(request, "home.html", context)

            result = run_decomposition(tensor, algorithm, **algo_kwargs)
            analysis = analyze_decomposition(tensor, algorithm, result)
            
            source_name = Path(uploaded_file.name).stem if uploaded_file else "manual"
            comp_ratio = round(analysis.get("compression_ratio", 0))
            export_filename = f"decomposed_{algorithm}_{comp_ratio}_{source_name}.json"

            export_path = export_result(
                {
                    "tensor": tensor_data,
                    "algorithm": algorithm,
                    "action": action,
                    "result": result,
                    "analysis": analysis,
                },
                filename=export_filename,
                output_dir=Path("results"),
            )
            context = _build_base_context(tensor_data, algorithm, action, ranks_input=ranks_input)
            context.update(
                {
                    "result": result,
                    "result_json": _pretty_json(result),
                    "analysis": analysis,
                    "analysis_json": _pretty_json(analysis),
                    "download_url": export_path.name,
                }
            )
            if request.headers.get("x-requested-with") == "XMLHttpRequest":
                return HttpResponse(json.dumps(context, default=_json_default), content_type="application/json")
            return render(request, "home.html", context)
        except Exception as exc:  # noqa: BLE001
            context = _build_base_context(None, algorithm, action)
            context["error"] = str(exc)
            if request.headers.get("x-requested-with") == "XMLHttpRequest":
                return HttpResponse(json.dumps({"error": str(exc)}, default=_json_default), content_type="application/json", status=400)
            return render(request, "home.html", context, status=400)

    return render(request, "home.html", _build_base_context(None, "cp", "decompose"))


def download_result(request: HttpRequest, filename: str) -> HttpResponse:
    import os
    from django.conf import settings

    safe_filename = Path(filename).name
    if os.environ.get("VERCEL"):
        file_path = Path("/tmp/results") / safe_filename
    else:
        file_path = Path(settings.BASE_DIR) / "results" / safe_filename

    if not file_path.exists():
        return HttpResponse("File not found", status=404)
    response = HttpResponse(file_path.read_text(encoding="utf-8"), content_type="application/json")
    response["Content-Disposition"] = f'attachment; filename="{safe_filename}"'
    return response

