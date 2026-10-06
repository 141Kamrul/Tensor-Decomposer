"""Automated User Acceptance Tests (UAT) using Playwright and Django StaticLiveServerTestCase.

End-to-End Acceptance Tests simulating real browser interactions:
1. Page load, UI components, and Theme switching (Dark/Light mode).
2. Auto-insert random 3D tensor and decompose flow.
3. Interactive reconstruction dual-tensor comparison with synchronized slice slider navigation.
4. Performance benchmark flow.
5. Multi-method comparison table flow.
6. User input validation & browser error display.
"""

import json
import os
from pathlib import Path
import sys
import tempfile
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"

if not django.apps.apps.ready:
    django.setup()

from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from playwright.sync_api import sync_playwright


def _should_run_headless() -> bool:
    """Determine whether to run Chromium in headless or headed mode.
    
    Headed mode (interactive browser window) is active when:
    - Running pytest with '--headed'
    - Or setting environment variable HEADED=1 / PLAYWRIGHT_HEADED=1
    - Or running test_acceptance.py directly when a graphical display is available
    Headless mode is active when:
    - Running with '--headless' or HEADLESS=1
    - Or in CI / environments without DISPLAY / WAYLAND_DISPLAY
    - Or running full manage.py test suite unless HEADED=1 is set
    """
    if "--headless" in sys.argv or os.environ.get("HEADLESS", "").lower() in ("1", "true", "yes"):
        return True
    if "--headed" in sys.argv or os.environ.get("HEADED", "").lower() in ("1", "true", "yes"):
        return False
    if os.environ.get("PLAYWRIGHT_HEADED", "").lower() in ("1", "true", "yes"):
        return False
    if not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY"):
        return True
    if os.environ.get("CI"):
        return True
    # If running generic manage.py test without targeting acceptance, keep it headless
    if any("manage.py" in arg for arg in sys.argv) and not any("test_acceptance" in arg for arg in sys.argv):
        return True
    return False


def _get_slow_mo() -> int:
    """Return milliseconds to delay each Playwright action for visual clarity when headed."""
    for i, arg in enumerate(sys.argv):
        if arg.startswith("--slowmo="):
            try:
                return int(arg.split("=")[1])
            except ValueError:
                pass
        elif arg == "--slowmo" and i + 1 < len(sys.argv):
            try:
                return int(sys.argv[i + 1])
            except ValueError:
                pass
    if "SLOWMO" in os.environ:
        try:
            return int(os.environ["SLOWMO"])
        except ValueError:
            pass
    return 120 if not _should_run_headless() else 0


class PlaywrightAcceptanceTests(StaticLiveServerTestCase):
    """Comprehensive end-to-end acceptance tests simulating real user workflows with Playwright."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.playwright = sync_playwright().start()
        is_headless = _should_run_headless()
        slow_mo = _get_slow_mo()
        cls.browser = cls.playwright.chromium.launch(
            headless=is_headless,
            slow_mo=slow_mo,
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        self.page = self.browser.new_page()

    def tearDown(self):
        self.page.close()
        super().tearDown()

    # -------------------------------------------------------------------------
    # 1. UI, Navigation & Dynamic Inputs
    # -------------------------------------------------------------------------

    def test_acceptance_page_load_and_theme_toggle(self):
        """User accesses the application, checks branding headers, and toggles dark/light theme."""
        self.page.goto(self.live_server_url)

        self.assertIn("Tensor Decomposer", self.page.title())
        header_text = self.page.locator(".hero-title-main").inner_text()
        self.assertEqual(header_text, "Tensor Decomposer")

        html_el = self.page.locator("html")
        initial_theme = html_el.get_attribute("data-theme")

        # Toggle theme
        self.page.locator("#theme-toggle").click()
        toggled_theme = html_el.get_attribute("data-theme")
        self.assertNotEqual(initial_theme, toggled_theme)

    def test_acceptance_auto_insert_all_shape_chips(self):
        """User can auto-insert tensors of all 4 supported preset shapes via quick-chips."""
        self.page.goto(self.live_server_url)
        textarea = self.page.locator("#tensor_input")
        feedback = self.page.locator("#random-tensor-feedback")

        chips = [
            ("3,3,3", "3×3×3"),
            ("4,3,2", "4×3×2"),
            ("2,2,2,2", "2×2×2×2"),
            ("3,2,3,2", "3×2×3×2"),
        ]

        for shape_attr, label in chips:
            chip_btn = self.page.locator(f"button.btn-random-chip[data-shape='{shape_attr}']")
            self.assertTrue(chip_btn.is_visible())
            chip_btn.click()

            val = textarea.input_value().strip()
            self.assertTrue(val.startswith("["))
            self.assertTrue(val.endswith("]"))
            self.assertIn(label, feedback.inner_text())

    def test_acceptance_ranks_hint_dynamic_update(self):
        """User sees dynamically updated rank hint badges and bounds when changing algorithms."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='3,3,3']").click()

        badge = self.page.locator("#ranks-hint-badge")

        # CP hint: Rank R
        self.page.select_option("#algorithm", "cp")
        self.assertIn("rank", badge.inner_text().lower())

        # Tucker hint: R₁, R₂, R₃
        self.page.select_option("#algorithm", "tucker")
        self.assertIn("r", badge.inner_text().lower())

        # Tensor Train hint: TT-ranks (Interior bonds)
        self.page.select_option("#algorithm", "tensor_train")
        self.assertIn("tt-ranks", badge.inner_text().lower())

    # -------------------------------------------------------------------------
    # 2. Decompose Flow Across All Algorithms
    # -------------------------------------------------------------------------

    def test_acceptance_decompose_cp_algorithm(self):
        """User decomposes a 3D tensor using CP decomposition with target rank."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='3,3,3']").click()
        self.page.select_option("#algorithm", "cp")
        self.page.locator("#ranks_input").fill("2")
        self.page.locator("button.btn-decompose").click()

        decomp_panel = self.page.locator("#panel-decomposition")
        decomp_panel.wait_for(state="visible", timeout=10000)
        self.assertTrue(decomp_panel.is_visible())

        pre_text = decomp_panel.locator("pre").inner_text()
        self.assertIn("Factors", pre_text)
        dl_btn = decomp_panel.locator(".download-btn")
        self.assertTrue(dl_btn.is_visible())

    def test_acceptance_decompose_tucker_algorithm(self):
        """User decomposes a 3D tensor using Tucker decomposition with custom ranks."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='4,3,2']").click()
        self.page.select_option("#algorithm", "tucker")
        self.page.locator("#ranks_input").fill("2, 2, 2")
        self.page.locator("button.btn-decompose").click()

        decomp_panel = self.page.locator("#panel-decomposition")
        decomp_panel.wait_for(state="visible", timeout=10000)

        pre_text = decomp_panel.locator("pre").inner_text()
        self.assertIn("Core:", pre_text)
        self.assertIn("Factors:", pre_text)

    def test_acceptance_decompose_hosvd_algorithm(self):
        """User decomposes a tensor using HOSVD algorithm."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='3,3,3']").click()
        self.page.select_option("#algorithm", "hosvd")
        self.page.locator("button.btn-decompose").click()

        decomp_panel = self.page.locator("#panel-decomposition")
        decomp_panel.wait_for(state="visible", timeout=10000)

        pre_text = decomp_panel.locator("pre").inner_text()
        self.assertIn("Core:", pre_text)
        self.assertIn("Factors:", pre_text)

    def test_acceptance_decompose_tensor_train_algorithm(self):
        """User decomposes a 4D tensor using Tensor Train (TT) decomposition."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='2,2,2,2']").click()
        self.page.select_option("#algorithm", "tensor_train")
        self.page.locator("button.btn-decompose").click()

        decomp_panel = self.page.locator("#panel-decomposition")
        decomp_panel.wait_for(state="visible", timeout=10000)

        pre_text = decomp_panel.locator("pre").inner_text()
        self.assertIn("Cores:", pre_text)

    def test_acceptance_decompose_all_puzzle_tensor_methods(self):
        """User can run all 4 PuzzleTensor augmented algorithms successfully."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='3,3,3']").click()

        puzzle_algorithms = [
            "cp_puzzle",
            "tucker_puzzle",
            "hosvd_puzzle",
            "tensor_train_puzzle",
        ]

        for algo in puzzle_algorithms:
            self.page.select_option("#algorithm", algo)
            self.page.locator("button.btn-decompose").click()

            decomp_panel = self.page.locator("#panel-decomposition")
            decomp_panel.wait_for(state="visible", timeout=10000)
            self.assertTrue(decomp_panel.is_visible())

    # -------------------------------------------------------------------------
    # 3. Actions: Visualize, Restruct & Accuracy, Benchmark, Compare
    # -------------------------------------------------------------------------

    def test_acceptance_visualize_flow(self):
        """User clicks Visualize and inspects interactive heatmaps and core tensor slice views."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='3,3,3']").click()
        self.page.select_option("#algorithm", "tucker")
        self.page.locator("button.btn-visualize").click()

        vis_panel = self.page.locator("#panel-visualization")
        vis_panel.wait_for(state="visible", timeout=10000)
        self.assertTrue(vis_panel.is_visible())

        # Verify heatmaps/equation rendered
        self.assertTrue(vis_panel.locator("svg").count() > 0)

    def test_acceptance_reconstruction_viewer_and_slice_slider(self):
        """User runs Restruct & Accuracy, compares dual tensors side-by-side, and slides through slices."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='3,3,3']").click()
        self.page.select_option("#algorithm", "cp")
        self.page.locator("button.btn-analyze").click()

        analysis_panel = self.page.locator("#panel-analysis")
        analysis_panel.wait_for(state="visible", timeout=10000)

        mae_el = self.page.locator("#metric-mae")
        self.assertTrue(len(mae_el.inner_text().strip()) > 0)

        viewer_container = self.page.locator("#reconstruction-viewer-container")
        viewer_container.wait_for(state="visible", timeout=10000)

        orig_card = viewer_container.locator(".visual-card", has_text="Original Tensor (X)")
        recon_card = viewer_container.locator(".visual-card", has_text="Reconstructed Tensor (X̂)")
        self.assertTrue(orig_card.is_visible())
        self.assertTrue(recon_card.is_visible())

        # Test synchronized slice navigation slider
        slider = viewer_container.locator(".slice-range-slider")
        badge = viewer_container.locator(".slice-badge")
        self.assertEqual(badge.inner_text(), "Slice 1 / 3")

        slider.fill("1")
        slider.dispatch_event("input")
        self.page.wait_for_timeout(300)
        self.assertEqual(badge.inner_text(), "Slice 2 / 3")

        # Verify download reconstructed JSON button exists
        dl_btn = self.page.locator("#btn-download-recon")
        self.assertTrue(dl_btn.is_visible())

    def test_acceptance_benchmark_flow(self):
        """User runs Benchmark and views execution time, FLOPs, and speedup charts."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='3,3,3']").click()
        self.page.select_option("#algorithm", "hosvd")
        self.page.locator("button.btn-benchmark").click()

        bm_panel = self.page.locator("#panel-benchmark")
        bm_panel.wait_for(state="visible", timeout=10000)

        time_metric = self.page.locator("#metric-avg-time")
        self.assertIn("ms", time_metric.inner_text())

    def test_acceptance_compare_methods_flow(self):
        """User clicks Compare All Methods and inspects the 8-method comparison table."""
        self.page.goto(self.live_server_url)
        self.page.locator("button.btn-random-chip[data-shape='3,3,3']").click()
        self.page.locator("button.btn-compare").click()

        comp_panel = self.page.locator("#panel-comparison")
        comp_panel.wait_for(state="visible", timeout=15000)

        rows = comp_panel.locator("tbody tr")
        self.assertEqual(rows.count(), 8)

    # -------------------------------------------------------------------------
    # 4. Input Variations: 2D Matrix & File Upload
    # -------------------------------------------------------------------------

    def test_acceptance_decompose_2d_matrix_input(self):
        """User enters a 2D matrix directly and runs decomposition successfully."""
        self.page.goto(self.live_server_url)
        self.page.locator("#tensor_input").fill("[[1, 2, 3], [4, 5, 6], [7, 8, 9]]")
        self.page.select_option("#algorithm", "cp")
        self.page.locator("button.btn-decompose").click()

        decomp_panel = self.page.locator("#panel-decomposition")
        decomp_panel.wait_for(state="visible", timeout=10000)
        self.assertTrue(decomp_panel.is_visible())

    def test_acceptance_decompose_file_upload_json(self):
        """User uploads a valid JSON tensor file, which clears manual input and decomposes."""
        self.page.goto(self.live_server_url)

        tensor_sample = [[[1, 2], [3, 4]], [[5, 6], [7, 8]]]
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(tensor_sample, f)
            temp_path = f.name

        try:
            self.page.set_input_files("#tensor_file", temp_path)
            self.page.select_option("#algorithm", "cp")
            self.page.locator("button.btn-decompose").click()

            decomp_panel = self.page.locator("#panel-decomposition")
            decomp_panel.wait_for(state="visible", timeout=10000)
            self.assertTrue(decomp_panel.is_visible())
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    # -------------------------------------------------------------------------
    # 5. False Inputs, Edge Cases & Error Panels
    # -------------------------------------------------------------------------

    def test_acceptance_error_empty_input(self):
        """User clicks decompose with empty input and receives clear validation error."""
        self.page.goto(self.live_server_url)
        self.page.locator("#tensor_input").fill("")
        self.page.locator("button.btn-decompose").click()

        error_panel = self.page.locator("#panel-error")
        error_panel.wait_for(state="visible", timeout=10000)
        msg = self.page.locator(".error-message").inner_text()
        self.assertIn("please enter a tensor", msg.lower())

    def test_acceptance_error_malformed_json(self):
        """User enters malformed JSON syntax and receives clear format error."""
        self.page.goto(self.live_server_url)
        self.page.locator("#tensor_input").fill("[[[1, 2], [3, 4]")
        self.page.locator("button.btn-decompose").click()

        error_panel = self.page.locator("#panel-error")
        error_panel.wait_for(state="visible", timeout=10000)
        msg = self.page.locator(".error-message").inner_text()
        self.assertTrue(any(term in msg.lower() for term in ["incomplete", "invalid", "brackets"]))

    def test_acceptance_error_ragged_tensor(self):
        """User enters ragged/irregular tensor rows and receives inhomogeneous shape error."""
        self.page.goto(self.live_server_url)
        self.page.locator("#tensor_input").fill("[[1, 2], [3, 4, 5]]")
        self.page.locator("button.btn-decompose").click()

        error_panel = self.page.locator("#panel-error")
        error_panel.wait_for(state="visible", timeout=10000)
        msg = self.page.locator(".error-message").inner_text()
        self.assertIn("ragged", msg.lower())

    def test_acceptance_error_non_numeric(self):
        """User enters non-numeric string values and receives numerical conversion error."""
        self.page.goto(self.live_server_url)
        self.page.locator("#tensor_input").fill('[["alpha", "beta"], ["gamma", "delta"]]')
        self.page.locator("button.btn-decompose").click()

        error_panel = self.page.locator("#panel-error")
        error_panel.wait_for(state="visible", timeout=10000)
        msg = self.page.locator(".error-message").inner_text()
        self.assertIn("could not convert string to float", msg)

    def test_acceptance_error_1d_tensor(self):
        """User enters a 1D vector and receives at least 2 dimensions error."""
        self.page.goto(self.live_server_url)
        self.page.locator("#tensor_input").fill("[1, 2, 3, 4]")
        self.page.locator("button.btn-decompose").click()

        error_panel = self.page.locator("#panel-error")
        error_panel.wait_for(state="visible", timeout=10000)
        msg = self.page.locator(".error-message").inner_text()
        self.assertIn("at least 2 dimensions", msg)

    def test_acceptance_error_corrupt_file_upload(self):
        """User uploads non-text binary file and receives unsupported format error."""
        self.page.goto(self.live_server_url)

        with tempfile.NamedTemporaryFile("wb", suffix=".bin", delete=False) as f:
            f.write(b"\x80\xff\xfe\x00\x01\x02")
            temp_path = f.name

        try:
            self.page.set_input_files("#tensor_file", temp_path)
            self.page.locator("button.btn-decompose").click()

            error_panel = self.page.locator("#panel-error")
            error_panel.wait_for(state="visible", timeout=10000)
            msg = self.page.locator(".error-message").inner_text()
            self.assertIn("Unsupported file format", msg)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
