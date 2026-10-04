FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS development

COPY angular.json tsconfig.json tsconfig.app.json .postcssrc.json proxy.conf.json proxy.docker.conf.json ./
COPY src ./src
COPY public ./public
EXPOSE 4200
CMD ["sh", "-c", "echo '[TypeDash frontend] Watching local files; Angular will log every detected change and browser reload.' && npm start -- --host 0.0.0.0 --port 4200 --poll 500 --proxy-config proxy.docker.conf.json"]

FROM dependencies AS build

COPY angular.json tsconfig.json tsconfig.app.json .postcssrc.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
