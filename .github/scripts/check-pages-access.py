"""Confirm the exact manual Pages project without revealing credentials."""
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    account = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
    project = os.environ.get('CLOUDFLARE_PAGES_PROJECT', '')
    token = os.environ.get('CLOUDFLARE_API_TOKEN', '')
    if (not re.fullmatch(r'[a-f0-9]{32}', account)
            or not re.fullmatch(r'[a-z0-9][a-z0-9-]*', project)
            or not token or token != token.strip()):
        raise RuntimeError('Invalid Cloudflare deployment configuration.')
    request = Request(
        f'https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{project}',
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'},
    )
    with urlopen(request, timeout=30) as response:
        data = json.load(response)
    result = data.get('result', {})
    if not data.get('success') or result.get('name') != project:
        raise RuntimeError('Cloudflare did not confirm the requested Pages project.')
    if result.get('production_branch') != 'main' or result.get('source'):
        raise RuntimeError('Use a direct-upload Pages project with main as the production branch.')


if __name__ == '__main__':
    try:
        main()
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, RuntimeError):
        sys.stderr.write('::error::Pages access check failed. Check the token, account and project configuration.\n')
        sys.exit(1)
