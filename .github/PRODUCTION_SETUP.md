# Manual production releases

The workflow is `.github/workflows/deploy-production.yml`. It only runs when you press **Run workflow**, not on a push. Select **main**.

## Required setup, once

### 1. Disable the providers' automatic deployments

- **Render:** service → Settings → Build & Deploy → Auto-Deploy → **Off**.
- **Netlify:** Project configuration → Developer settings → Continuous deployment → Build settings → Configure → Build status → **Stopped builds**.

Do not use **Lock to stop auto publishing** as a substitute. The workflow publishes prebuilt files through the Netlify CLI. Stopping Netlify-hosted builds allows this upload while preventing Git pushes and build hooks from building the project.

### 2. Add four GitHub secrets

Open the TypeDash GitHub repository → **Settings → Secrets and variables → Actions → Secrets → New repository secret**.

| Name | Where to find the value |
| --- | --- |
| `RENDER_API_KEY` | Render account settings → API Keys → create a key authorized for the service |
| `RENDER_SERVICE_ID` | Render service ID, starting with `srv-`, in service details or its dashboard URL; NOT the service name or a `dep-` deployment ID |
| `NETLIFY_AUTH_TOKEN` | Netlify user settings → Applications → Personal access tokens → create a token |
| `NETLIFY_SITE_ID` | Netlify project's configuration/details → Project ID (also called Site ID); NOT the site URL |

Tokens grant deployment access. Never paste them into a commit, screenshot or chat. Supabase credentials stay on Render; the workflow does not need them.

### 3. Add two GitHub variables

In the same GitHub page, select **Variables → New repository variable**.

| Name | Value |
| --- | --- |
| `TYPEDASH_API_ORIGIN` | Your actual backend HTTPS origin, e.g. `https://your-service.onrender.com` |
| `TYPEDASH_SITE_ORIGIN` | Your actual public website HTTPS origin, e.g. `https://your-project.netlify.app` |

No `/api` suffix, paths or trailing query strings. These are public URLs, not passwords. Unlike the Netlify-hosted build, GitHub Actions does not have Netlify's automatic `URL` variable, so the site origin must be supplied explicitly.

## Release a version

1. Commit and push your application changes to `main`.
2. Open the repository → **Actions → Deploy production**.
3. Press **Run workflow**, select `main`, leave **Deploy to production after successful builds** checked, then confirm **Run workflow**. Uncheck it to verify builds only: neither Render nor Netlify will be deployed. Build-only runs require the two public URL variables but not the four deployment secrets.
4. Follow the three jobs:
   - **Verify production builds:** checks required configuration, builds/prerenders Angular, builds the FastAPI production Docker image, and checks backend imports/OpenAPI without touching the real database.
   - **Deploy backend and wait for Render:** requests the exact workflow commit, polls that deployment for up to 20 minutes, checks its commit and status, then checks `/api/health` for up to two minutes.
   - **Publish verified frontend to Netlify:** uploads the previously verified Angular artifact to production, without rebuilding.
5. Check the live website and its statistics.

The workflow file must be on the default branch for the manual button to appear. If Actions is disabled, enable it in repository settings.

## Failure behavior

- Failed build: neither platform is deployed.
- Failed/canceled Render deploy, unexpected status, wrong commit, API error, timeout or unhealthy backend: frontend job is skipped.
- Netlify failure: the workflow fails. A successfully deployed backend stays deployed; this is not an atomic cross-platform release or an automatic rollback.
- New button clicks do not cancel an in-progress release. GitHub concurrency queues runs and may replace a pending run with a newer one.
- A canceled/timed-out GitHub run may leave a Render deployment running remotely. Check Render before retrying.
- Keep backend changes compatible with the currently live frontend while the two releases are in progress.

Local verification does not contact your production providers. The first real run requires the secrets and provider settings above. This configuration does not automatically modify Render, Netlify or GitHub settings.

References: [GitHub manual workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [Render deployment API](https://api-docs.render.com/reference/create-deploy), [Netlify stopped builds and CLI uploads](https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/).
