FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy root manifests first so npm can resolve the monorepo workspaces.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/database/package.json ./packages/database/package.json

RUN npm ci --omit=dev

# Copy only the API source tree required at runtime.
COPY apps/api/src ./apps/api/src

EXPOSE 3000

CMD ["node", "apps/api/src/main.js"]
