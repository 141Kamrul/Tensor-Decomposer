from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

from .decomposition import export_result, parse_tensor_input, run_decomposition


def home(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        raw_tensor = request.POST.get("tensor_input", "")
        algorithm = request.POST.get("algorithm", "svd")
        uploaded_file = request.FILES.get("tensor_file")

        try:
            if uploaded_file is not None:
                raw_tensor = uploaded_file.read().decode("utf-8")
            tensor = parse_tensor_input(raw_tensor)
            result = run_decomposition(tensor, algorithm)
            export_path = export_result(result, output_dir=Path("results"))
            context = {
                "tensor": tensor.tolist(),
                "algorithm": algorithm,
                "result": result,
                "download_url": export_path.name,
            }
            return render(request, "home.html", context)
        except Exception as exc:  # noqa: BLE001
            context = {"error": str(exc), "algorithm": algorithm}
            return render(request, "home.html", context, status=400)

    return render(request, "home.html", {})


def download_result(request: HttpRequest, filename: str) -> HttpResponse:
    file_path = Path("results") / filename
    if not file_path.exists():
        return HttpResponse("File not found", status=404)
    return HttpResponse(file_path.read_text(encoding="utf-8"), content_type="application/json")
