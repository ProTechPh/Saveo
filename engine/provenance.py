"""Local provenance receipts: sha256 + a sidecar next to each downloaded file."""

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


def sha256_file(path: str, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sidecar_path(media_path: str) -> str:
    return f"{media_path}.saveo.json"


def write_sidecar(media_path: str, data: Dict[str, Any]) -> str:
    target = Path(sidecar_path(media_path))
    payload = dict(data)
    payload.setdefault("generated_at", datetime.now(timezone.utc).isoformat())
    payload.setdefault("file", os.path.basename(media_path))
    tmp = target.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    os.replace(tmp, target)
    return str(target)


def read_sidecar(media_path: str) -> Optional[Dict[str, Any]]:
    target = Path(sidecar_path(media_path))
    if not target.exists():
        return None
    try:
        with open(target, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def verify_file(media_path: str, expected_sha256: str = "") -> Dict[str, Any]:
    """Compare the file on disk with the stored receipt (or an explicit hash)."""
    if not media_path or not os.path.isfile(media_path):
        return {"status": "missing", "expected_sha256": expected_sha256, "actual_sha256": ""}

    sidecar = read_sidecar(media_path) or {}
    expected = (expected_sha256 or sidecar.get("sha256") or "").lower()
    actual = sha256_file(media_path)
    if not expected:
        return {
            "status": "unverified",
            "expected_sha256": "",
            "actual_sha256": actual,
            "sidecar_path": sidecar_path(media_path),
        }
    return {
        "status": "verified" if actual == expected else "changed",
        "expected_sha256": expected,
        "actual_sha256": actual,
        "sidecar_path": sidecar_path(media_path),
    }
