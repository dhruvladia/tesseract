# Build context: repo root (see docker-compose.yml)
FROM node:24-alpine AS base
RUN npm i -g pnpm@12.5.1
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @tesseract/api... --prod

COPY packages/shared packages/shared
COPY apps/api apps/api

ENV NODE_ENV=production PORT=3001
EXPOSE 3001
# tsx runs the TypeScript sources directly; migrations apply on boot.
CMD ["pnpm", "--filter", "@tesseract/api", "start"]
