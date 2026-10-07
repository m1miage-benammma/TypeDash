"""Validate required environment names without exposing their values."""
import os
import sys

required = ["TYPEDASH_API_ORIGIN", "TYPEDASH_SITE_ORIGIN", "RENDER_API_KEY",
            "RENDER_SERVICE_ID", "NETLIFY_AUTH_TOKEN", "NETLIFY_SITE_ID"]
missing = [name for name in required if not os.environ.get(name, "").strip()]
if missing:
    sys.stderr.write("::error::Missing GitHub Actions configuration: " + ", ".join(missing) + "\n")
    sys.exit(1)
