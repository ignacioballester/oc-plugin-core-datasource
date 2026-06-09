"""Unit tests for the editor doc-map generator over a small fixture."""

from __future__ import annotations

import textwrap
from pathlib import Path

import gen_functions as g


def _write_fixture(tmp_path: Path) -> Path:
    metrics = tmp_path / "metrics"
    metrics.mkdir()
    (metrics / "__init__.py").write_text(
        textwrap.dedent(
            '''
            """fixture package."""
            from .mod import alpha, beta, gamma, divider_doc, empty_doc
            __all__ = ["alpha", "beta", "gamma", "divider_doc", "empty_doc"]
            '''
        )
    )
    (metrics / "mod.py").write_text(
        textwrap.dedent(
            '''
            """module docstring (should be ignored)."""

            def alpha(x: int, y: float = 1.0) -> float:
                """Add x and y.

                Longer explanation across
                multiple lines.
                """
                return x + y

            def beta(*, lookback: int, scale: float = 2.0) -> int:
                """Keyword-only signature."""
                return lookback

            def gamma(a, b, /, c) -> None:
                """Positional-only marker."""

            def _helper(z: int) -> int:
                """Private — must be excluded."""
                return z

            def divider_doc() -> None:
                """----------------"""

            def empty_doc() -> None:
                pass

            def not_exported() -> None:
                """Defined but not in __all__ — excluded."""
            '''
        )
    )
    return metrics


def test_parse_all(tmp_path: Path):
    metrics = _write_fixture(tmp_path)
    names = g.parse_all((metrics / "__init__.py").read_text())
    assert names == ["alpha", "beta", "gamma", "divider_doc", "empty_doc"]


def test_intended_functions_surfaced(tmp_path: Path):
    funcs = g.collect_functions(_write_fixture(tmp_path))
    # Order preserved from __all__.
    assert list(funcs.keys()) == ["alpha", "beta", "gamma", "divider_doc", "empty_doc"]


def test_helpers_and_unexported_excluded(tmp_path: Path):
    funcs = g.collect_functions(_write_fixture(tmp_path))
    assert "_helper" not in funcs
    assert "not_exported" not in funcs


def test_signature_rendering(tmp_path: Path):
    funcs = g.collect_functions(_write_fixture(tmp_path))
    assert funcs["alpha"]["signature"] == "alpha(x: int, y: float = 1.0) -> float"
    assert funcs["beta"]["signature"] == "beta(*, lookback: int, scale: float = 2.0) -> int"
    assert funcs["gamma"]["signature"] == "gamma(a, b, /, c) -> None"


def test_docstring_capture_and_dedent(tmp_path: Path):
    funcs = g.collect_functions(_write_fixture(tmp_path))
    assert funcs["alpha"]["doc"].startswith("Add x and y.")
    assert "multiple lines." in funcs["alpha"]["doc"]


def test_divider_and_empty_docstrings_blanked(tmp_path: Path):
    funcs = g.collect_functions(_write_fixture(tmp_path))
    assert funcs["divider_doc"]["doc"] == ""
    assert funcs["empty_doc"]["doc"] == ""


def test_clean_doc_helper():
    assert g.clean_doc(None) == ""
    assert g.clean_doc("   ") == ""
    assert g.clean_doc("-----") == ""
    assert g.clean_doc("  real  ") == "real"
