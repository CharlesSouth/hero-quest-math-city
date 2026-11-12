"""Build the single-file game:  python build.py  ->  index.html

The game ships as ONE self-contained HTML file (no server, no internet needed).
The source is split into numbered pieces in src/ that are simply joined in order.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
parts = sorted((ROOT / "src").glob("[0-9][0-9]-*"))
html = "".join(p.read_text(encoding="utf-8") for p in parts)
(ROOT / "index.html").write_text(html, encoding="utf-8")
print(f"Built index.html from {len(parts)} source files ({len(html) // 1024} KB)")
