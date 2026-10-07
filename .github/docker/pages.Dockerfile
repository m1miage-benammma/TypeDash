FROM node:22-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global wrangler@4.148.0
ENV CI=true WRANGLER_SEND_METRICS=false
WORKDIR /workspace
COPY .github/wrangler.jsonc ./wrangler.jsonc
ENTRYPOINT ["wrangler"]
