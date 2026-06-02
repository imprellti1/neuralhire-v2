FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL=https://api-v2.neuralhire.com.br
ARG VITE_DEMO_ACCOUNT_ID=
ARG VITE_DEMO_ROLE=
ARG VITE_DEMO_USER_ID=
ARG VITE_APP_ENV=production
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEMO_ACCOUNT_ID=$VITE_DEMO_ACCOUNT_ID
ENV VITE_DEMO_ROLE=$VITE_DEMO_ROLE
ENV VITE_DEMO_USER_ID=$VITE_DEMO_USER_ID
ENV VITE_APP_ENV=$VITE_APP_ENV

COPY apps/web/public ./public
COPY apps/web/src ./src

RUN mkdir -p dist \
  && cp -R public/. dist/ \
  && cp -R src dist/src \
  && printf 'window.__NEURALHIRE_CONFIG__ = { VITE_API_URL: "%s", VITE_DEMO_ACCOUNT_ID: "%s", VITE_DEMO_ROLE: "%s", VITE_DEMO_USER_ID: "%s", VITE_APP_ENV: "%s" };\n' "$VITE_API_URL" "$VITE_DEMO_ACCOUNT_ID" "$VITE_DEMO_ROLE" "$VITE_DEMO_USER_ID" "$VITE_APP_ENV" > dist/runtime-config.js

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
