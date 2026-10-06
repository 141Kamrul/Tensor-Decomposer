# Tensor-Decomposer

A high-performance computational web application built with **Django**, **NumPy**, and **SciPy** for decomposing matrices and multi-dimensional tensors. It supports various decomposition algorithms, quantitative accuracy analysis (MAE, RMSE, Relative Error), theoretical complexity evaluation, FLOPS estimation, and performance benchmarking.

---

## Key Features

* **Tensor Decompositions:**
  * **CP (CANDECOMP/PARAFAC)**: Alternating Least Squares (CP-ALS) via Khatri-Rao products.
  * **Tucker Decomposition**: Higher-Order Orthogonal Iteration (HOOI) for core tensor and factor matrix extraction.
  * **HOSVD**: Higher-Order Singular Value Decomposition via multi-mode unfolding.
  * **Tensor Train (TT)**: Sequential SVD factorisation into 3D core tensor trains.
* **Matrix Decompositions:**
  * **SVD**: Singular Value Decomposition (`U`, `S`, `Vh`).
  * **Eigendecomposition**: Eigenvalues & Eigenvectors calculation for square matrices.
  * **QR Decomposition**: Orthogonal-triangular factorisation (`Q`, `R`).
  * **LU Decomposition**: Lower-Upper factorisation (`L`, `U`).
* **Performance & Analysis Tooling:**
  * Interactive operations: **Decompose**, **Benchmark**, and **Compare**.
  * Real-time metrics calculation: Compression Ratio, MAE, RMSE, Absolute Error, Relative Error.
  * Execution time benchmarking & FLOPs estimations.
  * Instant JSON result exporting and downloading.

---

## Prerequisites

* **Python:** `3.13+`
* **Package Manager:** [`uv`](https://github.com/astral-sh/uv) *(recommended)* or standard `pip` / `venv`.

---

## Quick Start (Local Setup)

### 1. Clone the Repository
```bash
git clone https://github.com/141Kamrul/Tensor-Decomposer.git
cd Tensor-Decomposer
```

### 2. Install Dependencies & Setup Virtual Environment

#### Option A: Using `uv` (Recommended)
```bash
uv sync
```

#### Option B: Using standard `pip` & `venv`
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Linux/macOS:
source .venv/bin/activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Install dependencies
pip install django numpy scipy scikit-learn pytest
```

### 3. Apply Database Migrations
```bash
# With uv:
uv run python manage.py migrate

# With standard python/venv:
python manage.py migrate
```

### 4. Run the Local Development Server
```bash
# With uv:
uv run python manage.py runserver

# With standard python/venv:
python manage.py runserver
```
Open your browser and navigate to: `http://127.0.0.1:8000/`

---

## Running Across Multiple Devices in the Same Local Setup (LAN / Wi-Fi)

You can host the application on one main computer (Server Device) and access the interface from any other device (Mobile Phone, Tablet, Laptop, or PC) connected to the **same Wi-Fi network or Local Area Network (LAN)**.

### Step 1: Bind Django to `0.0.0.0:8000`
Run the Django development server bound to `0.0.0.0`. This instructs Django to listen for incoming network requests on all network interfaces:

```bash
# With uv:
uv run python manage.py runserver 0.0.0.0:8000

# With standard python/venv:
python manage.py runserver 0.0.0.0:8000
```

> **Note:** `ALLOWED_HOSTS` is set to `['*']` in `config/settings.py` so requests from any IP address on the local network will be accepted.

---

### Step 2: Find the Host Device's Local IP Address

Run the command corresponding to the host operating system to find its IP address on your local network:

#### Linux:
```bash
hostname -I
# or
ip a
```
*Look for an IP like `192.168.x.x` or `10.x.x.x`.*

#### macOS:
```bash
ipconfig getifaddr en0
# (or en1 depending on Wi-Fi/Ethernet interface)
```

#### Windows (Command Prompt / PowerShell):
```cmd
ipconfig
```
*Look for `IPv4 Address` under your active Wi-Fi or Ethernet adapter.*

---

### Step 3: Access from Client Devices

On any device (Phone, Tablet, Laptop) connected to the **same Wi-Fi or LAN network**, open a web browser and type:

```text
http://<HOST_IP>:8000
```

*Example:* `http://192.168.1.100:8000`

---

### Troubleshooting Local Network Connections

If client devices cannot reach the host server (`Connection Timed Out` or `Site Cannot Be Reached`), ensure port `8000` is permitted through the host machine's firewall:

* **Linux (`ufw`):**
  ```bash
  sudo ufw allow 8000/tcp
  ```
* **Windows:**
  1. Open *Windows Defender Firewall*.
  2. Click *Advanced settings* -> *Inbound Rules* -> *New Rule*.
  3. Choose **Port** -> **TCP** -> Specific local ports: `8000` -> **Allow the connection**.
* **macOS:**
  Ensure Firewall settings allow incoming connections for Python under *System Settings > Network > Firewall*.

---

## Running Unit Tests

To verify that all algorithms, parsers, and services are functioning correctly:

```bash
# Using Django's test runner (with uv):
uv run python manage.py test

# Or using pytest:
uv run pytest
```

---

## Project Structure

```text
Tensor-Decomposer/
├── config/                          # Django system settings & root URL routing
│   ├── settings.py
│   └── urls.py
├── tensor_decomposer/               # Core application logic
│   ├── decomposition.py            # High-level pipeline: parsing, algorithm execution, JSON exporting
│   ├── views.py                     # HTTP/AJAX request handlers for web UI & downloads
│   ├── services/
│   │   ├── algorithms/              # Algorithm implementations
│   │   │   ├── matrix/              # Matrix algorithms: SVD, Eigendecomposition, QR, LU
│   │   │   └── tensor/              # Tensor algorithms: CP, Tucker, HOSVD, Tensor Train
│   │   └── function/                # Core mathematical utility services
│   │       ├── tensor_utils.py      # Matricization, mode-n product, Khatri-Rao, reconstruction
│   │       ├── analysis.py          # Reconstruction errors (MAE, RMSE) & compression ratio
│   │       └── benchmark.py         # Timing measurement, FLOP estimations & complexity
│   ├── templates/
│   │   └── home.html                # Interactive UI
│   └── tests/
│       └── test_decomposition.py    # Unit test suite
├── results/                         # Storage directory for exported decomposition JSON files
├── pyproject.toml                   # Project dependencies and configuration
└── manage.py                        # Django management CLI script
```

---

## Exported Results

When a decomposition or comparison is performed, JSON files containing the tensor data, factor matrices/core tensors, and performance analytics are saved to the `results/` folder and can be directly downloaded from the web interface.
