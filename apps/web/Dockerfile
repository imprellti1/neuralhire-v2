FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL=https://api-v2.neuralhire.com.br
ENV VITE_API_URL=$VITE_API_URL

COPY apps/web/public ./public
COPY apps/web/src ./src

RUN mkdir -p dist \
  && cp -R public/. dist/ \
  && cp -R src dist/src \
  && printf 'window.__NEURALHIRE_CONFIG__ = { VITE_API_URL: "%s" };\n' "$VITE_API_URL" > dist/runtime-config.js

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
