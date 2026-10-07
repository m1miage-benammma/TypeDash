"""Fail closed on known deployment credentials; never log their values."""
import base64
import os
from pathlib import Path
import sys
from urllib.parse import quote

root = Path("/published")
if not root.is_dir() or not (root / "index.html").is_file():
    sys.stderr.write("::error::Public build artifact is missing.\n")
    sys.exit(1)
patterns = set()
for name in ("RENDER_API_KEY", "RENDER_SERVICE_ID", "CLOUDFLARE_API_TOKEN"):
    value = os.environ.get(name, "")
    if not value:
        sys.stderr.write("::error::Deployment secret configuration is incomplete.\n")
        sys.exit(1)
    patterns.update((value.encode(), base64.b64encode(value.encode()), quote(value, safe="").encode()))
for path in root.rglob("*"):
    if not path.is_file():
        continue
    if path.name == ".env" or path.name.startswith(".env.") or any(value in path.read_bytes() for value in patterns):
        sys.stderr.write("::error::Sensitive configuration found in public artifact. Publication blocked.\n")
        sys.exit(1)
