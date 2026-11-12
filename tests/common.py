"""Shared settings for the browser tests."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME_URI = (ROOT / "index.html").as_uri()
SHOT_DIR = ROOT / "tests" / "screenshots"   # git-ignored
SHOT_DIR.mkdir(exist_ok=True)


def launch(pw, args=None):
    """Use Playwright's bundled Chromium, or set CHROME_PATH to use another Chrome."""
    path = os.environ.get("CHROME_PATH")
    return pw.chromium.launch(executable_path=path or None, args=args or [])
