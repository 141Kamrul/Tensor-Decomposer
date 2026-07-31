from __future__ import annotations

import json
from pathlib import Path
import time

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

from .decomposition import export_result, parse_tensor_input, run_decomposition
from .services.analysis import analyze_decomposition, compare_methods
from .services.benchmark import benchmark_algorithm
from .services.algorithms import SUPPORTED_ALGORITHMS


TENSOR_METHODS = ("cp", "tucker", "hosvd", "tensor_train")
REFERENCE_METHODS = ("svd", "eigendecomposition", "qr", "lu")
ALGORITHM_LABELS = {
    "cp": "CP Decomposition",
    "tucker": "Tucker Decomposition",
    "hosvd": "Higher Order Singular Value Decomposition",
    "tensor_train": "Tensor Train Decomposition",
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


def _build_base_context(tensor: object | None, algorithm: str, action: str) -> dict[str, object]:
    context: dict[str, object] = {
        "algorithm": algorithm,
        "action": action,
        "algorithm_options": SUPPORTED_ALGORITHMS,
        "algorithm_labels": ALGORITHM_LABELS,
        "tensor_methods": TENSOR_METHODS,
        "reference_methods": REFERENCE_METHODS,
        "cache_buster": str(int(time.time())),
    }
    if tensor is not None:
        context["tensor"] = tensor
    return context


def home(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        raw_tensor = request.POST.get("tensor_input", "")
        algorithm = request.POST.get("algorithm", "svd")
        action = request.POST.get("action", "decompose")
        uploaded_file = request.FILES.get("tensor_file")

        try:
            if uploaded_file is not None:
                raw_tensor = uploaded_file.read().decode("utf-8")
            tensor = parse_tensor_input(raw_tensor)
            tensor_data = tensor.tolist()

            if action == "benchmark":
                benchmark = benchmark_algorithm(tensor, algorithm)
                export_path = export_result({"tensor": tensor_data, "benchmark": benchmark}, output_dir=Path("results"))
                context = _build_base_context(tensor_data, algorithm, action)
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
                comparison = compare_methods(tensor, TENSOR_METHODS)
                export_path = export_result({"tensor": tensor_data, "comparison": comparison}, output_dir=Path("results"))
                context = _build_base_context(tensor_data, algorithm, action)
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

            result = run_decomposition(tensor, algorithm)
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
            context = _build_base_context(tensor_data, algorithm, action)
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
    file_path = Path("results") / filename
    if not file_path.exists():
        return HttpResponse("File not found", status=404)
    response = HttpResponse(file_path.read_text(encoding="utf-8"), content_type="application/json")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
