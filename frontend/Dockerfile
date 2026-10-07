FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev \
    && sha256sum package.json package-lock.json > node_modules/.typedash-dependencies.sha256

FROM dependencies AS development

COPY docker-start.sh /usr/local/bin/typedash-frontend-start
COPY angular.json tsconfig.json tsconfig.app.json .postcssrc.json proxy.conf.json proxy.docker.conf.json ./
COPY src ./src
COPY public ./public
EXPOSE 4200
CMD ["sh", "/usr/local/bin/typedash-frontend-start"]

FROM dependencies AS build

COPY angular.json tsconfig.json tsconfig.app.json .postcssrc.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
ARG TYPEDASH_API_ORIGIN=https://typedash-gkbn.onrender.com
RUN TYPEDASH_API_ORIGIN="$TYPEDASH_API_ORIGIN" node scripts/build-netlify.mjs

FROM scratch AS artifact

COPY --from=build /app/dist/frontend/browser /

FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
