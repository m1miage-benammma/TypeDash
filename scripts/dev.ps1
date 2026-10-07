param([ValidateSet('up', 'down', 'logs', 'build', 'checks')][string]$Action = 'up')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    switch ($Action) {
        'up' { docker compose up -d --build }
        'down' { docker compose down }
        'logs' { docker compose logs -f }
        'build' { docker compose -f docker-compose.ci.yml build backend frontend }
        'checks' { docker compose -f docker-compose.ci.yml --profile checks run --build --rm frontend-checks }
    }
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed with exit code $LASTEXITCODE." }
} finally { Pop-Location }
