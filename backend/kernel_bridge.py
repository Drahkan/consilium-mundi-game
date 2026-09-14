"""Call the sealed TypeScript kernel. Do not reimplement rules here."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parent.parent
CLI = ROOT / "packages" / "consilium-kernel" / "cli.mjs"
NODE = os.environ.get("KERNEL_NODE", "node")


class KernelError(RuntimeError):
    def __init__(self, message: str, payload: Dict[str, Any] | None = None):
        super().__init__(message)
        self.payload = payload or {}


def kernel(op: str, **payload: Any) -> Dict[str, Any]:
    body = json.dumps({"op": op, **payload}, separators=(",", ":"))
    try:
        proc = subprocess.run(
            [NODE, str(CLI)],
            input=body.encode("utf-8"),
            capture_output=True,
            timeout=120,
            cwd=str(ROOT),
            check=False,
        )
    except FileNotFoundError as e:
        raise KernelError(
            "Node.js is required to run the Consilium Mundi kernel. "
            "Install Node on the API host. Do not port the kernel to Python."
        ) from e
    raw = (proc.stdout or b"").decode("utf-8").strip()
    err = (proc.stderr or b"").decode("utf-8").strip()
    if not raw:
        raise KernelError(err or f"kernel produced no output (exit {proc.returncode})")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise KernelError(f"kernel returned non-JSON: {raw[:400]}") from e
    if not data.get("ok"):
        raise KernelError(str(data.get("error") or "kernel error"), data)
    return data
