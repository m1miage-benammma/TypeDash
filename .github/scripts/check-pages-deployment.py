"""Wait for the exact production commit, without logging API credentials."""
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    account = os.environ['CLOUDFLARE_ACCOUNT_ID']
    project = os.environ['CLOUDFLARE_PAGES_PROJECT']
    commit = os.environ['DEPLOY_COMMIT']
    token = os.environ['CLOUDFLARE_API_TOKEN']
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        request = Request(
            f'https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{project}',
            headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'},
        )
        with urlopen(request, timeout=30) as response:
            result = json.load(response)
        if not result.get('success'):
            raise RuntimeError()
        deployment = result['result'].get('canonical_deployment') or {}
        metadata = deployment.get('deployment_trigger', {}).get('metadata', {})
        if deployment.get('environment') == 'production' and metadata.get('commit_hash') == commit:
            status = deployment.get('latest_stage', {}).get('status')
            if status == 'success':
                return
            if status in ('failure', 'canceled'):
                raise RuntimeError()
        time.sleep(5)
    raise RuntimeError()


if __name__ == '__main__':
    try:
        main()
    except (KeyError, HTTPError, URLError, TimeoutError, OSError, ValueError, RuntimeError):
        sys.stderr.write('::error::Cloudflare has not confirmed the exact production commit.\n')
        sys.exit(1)
