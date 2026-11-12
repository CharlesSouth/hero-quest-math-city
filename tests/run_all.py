"""Run every browser test and report which passed.  Usage:  python tests/run_all.py"""
import subprocess, sys, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
tests = sorted(p for p in HERE.glob("test_*.py"))
failed = []
for t in tests:
    out = subprocess.run([sys.executable, str(t)], cwd=HERE, capture_output=True, text=True).stdout
    m = re.findall(r"FAILS: (\d+)", out)
    ok = bool(m) and m[-1] == "0"
    print(("PASS " if ok else "FAIL ") + t.name)
    if not ok:
        failed.append(t.name)
        print("\n".join(l for l in out.splitlines() if l.startswith("FAIL")) or out[-2000:])
print(f"\n{len(tests) - len(failed)}/{len(tests)} test files passed")
sys.exit(1 if failed else 0)
