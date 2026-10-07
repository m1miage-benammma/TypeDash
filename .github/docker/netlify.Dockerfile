FROM node:22-alpine
RUN npm install --global netlify-cli@27.10.2
ENV NETLIFY_TELEMETRY_DISABLED=1
WORKDIR /deploy
ENTRYPOINT ["netlify"]
