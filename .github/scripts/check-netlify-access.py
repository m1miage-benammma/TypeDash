"""Read-only Netlify preflight; never print credentials or API response bodies."""

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

API_ROOT = "https://api.netlify.com/api/v1"


class AccessError(RuntimeError):
    pass


def get_json(path, token, target):
    request = Request(API_ROOT + path, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
    })
    try:
        with urlopen(request, timeout=30) as response:
            result = json.load(response)
    except HTTPError as error:
        if error.code == 401:
            message = "Netlify rejected NETLIFY_AUTH_TOKEN (HTTP 401): invalid, expired or revoked token."
        elif error.code == 403:
            message = f"Netlify denied access to {target} (HTTP 403): check token and team permissions."
        elif error.code == 404:
            message = (f"Netlify cannot find or expose {target} to this token (HTTP 404). "
                       "Check NETLIFY_SITE_ID and token access to the project's team. "
                       "A 404 cannot distinguish a missing project from hidden access.")
        else:
            message = f"Netlify API returned HTTP {error.code}. Check Netlify availability and retry."
        raise AccessError(message) from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise AccessError("Netlify API request failed or returned invalid JSON. Check connectivity and retry.") from None
    if not isinstance(result, dict):
        raise AccessError("Netlify returned an unexpected API response. Deployment blocked.")
    return result


def main():
    token = os.environ.get("NETLIFY_AUTH_TOKEN", "")
    site_id = os.environ.get("NETLIFY_SITE_ID", "")
    if not token or not site_id:
        raise AccessError("Configure NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID in GitHub Actions repository secrets.")
    if token != token.strip() or site_id != site_id.strip():
        raise AccessError("Netlify secrets contain leading or trailing whitespace. Re-save them without spaces or newlines.")
    try:
        if str(UUID(site_id)) != site_id.lower():
            raise ValueError()
    except ValueError:
        raise AccessError("NETLIFY_SITE_ID must be the project's UUID, not a URL, name or quoted value.") from None

    user = get_json("/user", token, "the token's account")
    if not user.get("id"):
        raise AccessError("Netlify did not confirm the token's account. Deployment blocked.")
    print("Netlify token authenticated successfully.", flush=True)
    site = get_json("/sites/" + site_id, token, "the configured project")
    if site.get("id", "").lower() != site_id.lower():
        raise AccessError("Netlify did not confirm the requested project ID. Deployment blocked.")
    print("Netlify project found and readable by this token. Write permissions are checked during deployment.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except AccessError as error:
        print(f"::error::{error}", file=sys.stderr)
        sys.exit(1)
