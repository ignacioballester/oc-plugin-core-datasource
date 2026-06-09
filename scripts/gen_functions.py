#!/usr/bin/env python3
"""Generate the editor's hover doc-map from the compute metric library.

The public surface is exactly the names re-exported in
``compute.metrics.__init__.__all__``.  For each, we resolve the defining
module, read the source with ``ast``, and capture the function name, a
rendered signature, and its docstring.  The ``.py`` files are the single
source of truth — no endpoint, no runtime fetch.

Output: ``src/functions.json`` — ``{ "<name>": { "signature": "...",
"doc": "..." }, ... }`` — bundled into the editor package and consumed by the
Monaco hover provider.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
from pathlib import Path


def parse_all(init_src: str) -> list[str]:
    """Return the names listed in the module's ``__all__`` assignment."""
    tree = ast.parse(init_src)
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "__all__":
                    if isinstance(node.value, (ast.List, ast.Tuple)):
                        return [
                            el.value
                            for el in node.value.elts
                            if isinstance(el, ast.Constant) and isinstance(el.value, str)
                        ]
    return []


def render_signature(name: str, fn: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    """Render a Python-ish signature string from a function def node."""
    a = fn.args
    parts: list[str] = []

    pos = a.posonlyargs + a.args
    defaults = list(a.defaults)
    n_no_default = len(pos) - len(defaults)
    for i, arg in enumerate(pos):
        if i < n_no_default:
            parts.append(_render_arg(arg))
        else:
            default = defaults[i - n_no_default]
            parts.append(f"{_render_arg(arg)} = {_render_default(default)}")

    if a.posonlyargs:
        parts.insert(len(a.posonlyargs), "/")

    if a.vararg is not None:
        parts.append(f"*{_render_arg(a.vararg)}")
    elif a.kwonlyargs:
        parts.append("*")

    for arg, default in zip(a.kwonlyargs, a.kw_defaults):
        if default is None:
            parts.append(_render_arg(arg))
        else:
            parts.append(f"{_render_arg(arg)} = {_render_default(default)}")

    if a.kwarg is not None:
        parts.append(f"**{_render_arg(a.kwarg)}")

    returns = f" -> {_annotation(fn.returns)}" if fn.returns is not None else ""
    return f"{name}({', '.join(parts)}){returns}"


def _render_arg(arg: ast.arg) -> str:
    ann = _annotation(arg.annotation)
    return f"{arg.arg}: {ann}" if ann else arg.arg


def _annotation(node: ast.expr | None) -> str:
    if node is None:
        return ""
    try:
        return ast.unparse(node)
    except Exception:
        return ""


def _render_default(node: ast.expr) -> str:
    try:
        return ast.unparse(node)
    except Exception:
        return "..."


def clean_doc(doc: str | None) -> str:
    """Normalise a raw docstring: dedent, strip, collapse divider/blank-only docs."""
    if not doc:
        return ""
    cleaned = doc.strip()
    # A docstring that is only a rule of dashes/equals carries no information.
    if cleaned and re.fullmatch(r"[-=_\s]+", cleaned):
        return ""
    return cleaned


def collect_functions(metrics_dir: Path) -> dict[str, dict[str, str]]:
    """Map each ``__all__`` name to ``{signature, doc}`` from the metric modules."""
    init_path = metrics_dir / "__init__.py"
    names = parse_all(init_path.read_text())
    wanted = set(names)

    found: dict[str, dict[str, str]] = {}
    for py in sorted(metrics_dir.glob("*.py")):
        if py.name == "__init__.py":
            continue
        tree = ast.parse(py.read_text())
        for node in tree.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if node.name.startswith("_") or node.name not in wanted:
                continue
            found[node.name] = {
                "signature": render_signature(node.name, node),
                "doc": clean_doc(ast.get_docstring(node)),
            }

    # Preserve __all__ ordering; silently skip names with no def found
    # (e.g. re-exported helpers not surfaced as panel metrics).
    return {n: found[n] for n in names if n in found}


def main() -> int:
    here = Path(__file__).resolve().parent
    default_metrics = (
        here.parent.parent / "services" / "compute" / "compute" / "metrics"
    )
    default_out = here.parent / "src" / "components" / "functions.json"

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--metrics-dir", type=Path, default=default_metrics)
    ap.add_argument("--out", type=Path, default=default_out)
    args = ap.parse_args()

    funcs = collect_functions(args.metrics_dir)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(funcs, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(funcs)} functions to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
