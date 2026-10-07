"""Publish the verified static artifact directly, without CLI project discovery."""

import io
import json
import logging
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID
from zipfile import ZIP_DEFLATED, ZipFile

from check_netlify_access import AccessError, get_json

API_ROOT = "https://api.netlify.com/api/v1"
LOGGER = logging.getLogger(__name__)


def artifact_zip(root):
    if not (root / "index.html").is_file():
        raise AccessError("Verified frontend index.html is missing. Deployment blocked.")
    files = sorted(root.rglob("*"))
    payload = io.BytesIO()
    count = 0
    with ZipFile(payload, "w", ZIP_DEFLATED) as archive:
        for path in files:
            if path.is_symlink():
                raise AccessError("Symlinks are not allowed in the published artifact.")
            if not path.is_file():
                continue
            relative = path.relative_to(root)
            if any(part == ".env" or part.startswith(".env.") for part in relative.parts):
                raise AccessError("Environment files are not allowed in the published artifact.")
            count += 1
            if count > 25000:
                raise AccessError("Published artifact exceeds the Netlify ZIP file limit.")
            archive.write(path, relative.as_posix())
    return payload.getvalue()


def main():
    token = os.environ.get("NETLIFY_AUTH_TOKEN", "")
    site_id = os.environ.get("NETLIFY_SITE_ID", "")
    commit = os.environ.get("DEPLOY_COMMIT", "")
    if not token or token != token.strip() or site_id != site_id.strip():
        raise AccessError("Configure Netlify secrets without surrounding whitespace.")
    try:
        site_id = str(UUID(site_id))
    except ValueError:
        raise AccessError("NETLIFY_SITE_ID must be the project's UUID.") from None
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise AccessError("DEPLOY_COMMIT must be a full Git commit SHA.")
    site = get_json("/sites/" + site_id, token, "the configured project")
    if site.get("id") != site_id:
        raise AccessError("Netlify did not confirm the configured project.")
    if site.get("published_deploy", {}).get("locked"):
        raise AccessError("The published Netlify deploy is locked. Deployment blocked.")
    query = urlencode({"title": "TypeDash production " + commit, "draft": "false"})
    request = Request(
        f"{API_ROOT}/sites/{site_id}/deploys?{query}",
        data=artifact_zip(Path("/published")),
        method="POST",
        headers={"Authorization": "Bearer " + token,
                 "Content-Type": "application/zip", "Accept": "application/json"},
    )
    # Do not retry an ambiguous POST: it might already have created a deploy.
    try:
        with urlopen(request, timeout=60) as response:
            deploy = json.load(response)
    except HTTPError as error:
        raise AccessError(f"Netlify upload returned HTTP {error.code}.") from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise AccessError("Netlify upload failed. Inspect deploys before retrying.") from None
    deploy_id = deploy.get("id", "")
    if deploy.get("site_id") != site_id or not re.fullmatch(r"[a-f0-9]{24}", deploy_id):
        raise AccessError("Netlify did not confirm the new deployment.")
    deadline = time.monotonic() + 10 * 60
    last_state = None
    while time.monotonic() < deadline:
        deploy = get_json(f"/sites/{site_id}/deploys/{deploy_id}", token, "the new deployment")
        if deploy.get("id") != deploy_id or deploy.get("site_id") != site_id:
            raise AccessError("Netlify returned a different deployment.")
        state = deploy.get("state")
        if state != last_state:
            LOGGER.info("Netlify status: %s", state)
            last_state = state
        if state == "ready":
            site = get_json("/sites/" + site_id, token, "the configured project")
            if site.get("published_deploy", {}).get("id") == deploy_id:
                LOGGER.info("Verified frontend published successfully.")
                return
        elif state not in {"new", "pending_review", "accepted", "enqueued", "preparing",
                           "prepared", "uploading", "uploaded", "processing"}:
            raise AccessError("Netlify deployment failed or returned an unexpected state.")
        time.sleep(5)
    raise AccessError("Netlify did not confirm publication within 10 minutes.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        main()
    except AccessError as error:
        sys.stderr.write(f"::error::{error}\n")
        sys.exit(1)
