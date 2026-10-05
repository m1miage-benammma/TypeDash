"""Trigger one exact Render deployment and fail closed until it is healthy."""

import json
import os
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

API_ROOT = "https://api.render.com/v1"
PENDING = {
    "created", "build_in_progress", "pre_deploy_in_progress", "update_in_progress",
}
FAILED = {
    "build_failed", "pre_deploy_failed", "update_failed", "canceled", "deactivated",
}
DEPLOY_TIMEOUT = 20 * 60
HEALTH_TIMEOUT = 2 * 60
POLL_SECONDS = 15


class DeploymentError(RuntimeError):
    pass


def api_request(method, path, token, payload=None):
    request = Request(
        API_ROOT + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        # Do not log provider response bodies, headers or credentials.
        raise DeploymentError(f"Render API returned HTTP {error.code}.") from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise DeploymentError("Render API request failed. Check Render and retry the workflow.") from None


def verify_commit(deploy, commit):
    if deploy.get("commit", {}).get("id") != commit:
        raise DeploymentError("Render did not confirm the requested commit. Frontend publication blocked.")


def wait_for_render(service_id, deploy_id, commit, token):
    deadline = time.monotonic() + DEPLOY_TIMEOUT
    last_status = None
    while time.monotonic() < deadline:
        deploy = api_request("GET", f"/services/{service_id}/deploys/{deploy_id}", token)
        if deploy.get("id") != deploy_id:
            raise DeploymentError("Render returned a different deployment. Frontend publication blocked.")
        verify_commit(deploy, commit)
        status = deploy.get("status")
        if status != last_status:
            print(f"Render status: {status}", flush=True)
            last_status = status
        if status == "live":
            return
        if status in FAILED:
            raise DeploymentError(f"Render deployment failed ({status}). Frontend publication blocked.")
        if status not in PENDING:
            raise DeploymentError("Unexpected Render status. Frontend publication blocked.")
        time.sleep(POLL_SECONDS)
    raise DeploymentError("Render did not become live within 20 minutes. Frontend publication blocked.")


def wait_for_health(origin):
    deadline = time.monotonic() + HEALTH_TIMEOUT
    while time.monotonic() < deadline:
        try:
            request = Request(origin + "/api/health", headers={"Cache-Control": "no-cache"})
            with urlopen(request, timeout=15) as response:
                if response.status == 200 and json.load(response).get("data", {}).get("status") == "ok":
                    return
        except (HTTPError, URLError, TimeoutError, OSError, ValueError):
            pass
        time.sleep(5)
    raise DeploymentError("Backend health check failed. Frontend publication blocked.")


def main():
    token = os.environ.get("RENDER_API_KEY", "").strip()
    service_id = os.environ.get("RENDER_SERVICE_ID", "").strip()
    commit = os.environ.get("DEPLOY_COMMIT", "").strip()
    origin = os.environ.get("TYPEDASH_API_ORIGIN", "").strip().rstrip("/")
    if not token or not re.fullmatch(r"srv-[a-zA-Z0-9-]+", service_id):
        raise DeploymentError("Configure RENDER_API_KEY and the srv-... RENDER_SERVICE_ID.")
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise DeploymentError("DEPLOY_COMMIT must be a full Git commit SHA.")
    parsed = urlsplit(origin)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.path or parsed.query or parsed.fragment):
        raise DeploymentError("TYPEDASH_API_ORIGIN must be an HTTPS origin.")

    # No retry for POST: an ambiguous failure must not start duplicate deploys.
    deploy = api_request("POST", f"/services/{service_id}/deploys", token, {
        "commitId": commit, "clearCache": "do_not_clear",
    })
    deploy_id = deploy.get("id", "")
    if not re.fullmatch(r"dep-[a-zA-Z0-9-]+", deploy_id):
        raise DeploymentError("Render did not return a valid deployment ID.")
    print("Render accepted the deployment; waiting for this commit.", flush=True)
    wait_for_render(service_id, deploy_id, commit, token)
    wait_for_health(origin)
    print("Requested backend deployment is live and healthy. Frontend may be published.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except DeploymentError as error:
        print(f"::error::{error}", file=sys.stderr)
        sys.exit(1)
