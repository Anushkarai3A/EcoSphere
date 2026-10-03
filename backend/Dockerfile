# Backend runtime image: compiled TypeScript + Prisma client.
# Multi-stage so the runtime layer has no devDependencies / build tooling.

FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
# Install all workspace deps (root + backend + frontend) to satisfy the lockfile.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspaces --include-workspace-root

FROM deps AS build
COPY tsconfig.base.json ./
COPY backend/ backend/
COPY database/ database/
RUN npm run prisma:generate -w @ecosphere/backend
RUN npm run build -w @ecosphere/backend

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/database /app/database
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/server.js"]
