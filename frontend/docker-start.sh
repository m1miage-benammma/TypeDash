#!/bin/sh
set -eu

cd /app

# A persisted node_modules volume can hide the dependencies from a rebuilt image.
stamp="node_modules/.typedash-dependencies.sha256"
if [ ! -f "$stamp" ] \
    || ! sha256sum -c "$stamp" >/dev/null 2>&1 \
    || [ ! -f node_modules/@angular/ssr/package.json ] \
    || [ ! -f node_modules/@types/node/index.d.ts ]; then
    echo '[TypeDash frontend] Dependency changes or missing packages detected; synchronizing node_modules.'
    npm ci --include=dev
    sha256sum package.json package-lock.json > "$stamp"
    echo '[TypeDash frontend] Dependencies synchronized.'
fi

echo '[TypeDash frontend] Watching local files; Angular will log every detected change and browser reload.'
exec npm start -- --host 0.0.0.0 --port 4200 --poll 500 --proxy-config proxy.docker.conf.json
