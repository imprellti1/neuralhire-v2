FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_SUPABASE_URL=https://qvwbsadesksrhcslmmjg.supabase.co
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL=https://api.neuralhire.com.br
ARG VITE_APP_ENV=production

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_ENV=$VITE_APP_ENV

COPY apps/web/public ./public
COPY apps/web/src ./src

RUN mkdir -p dist \
  && cp -R public/. dist/ \
  && cp -R src dist/src

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
