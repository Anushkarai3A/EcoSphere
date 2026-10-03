# Frontend: build with Vite, serve static assets behind nginx (SPA fallback + API proxy).

FROM node:24-alpine AS build
WORKDIR /app
# The map uses free MapLibre GL with public OpenStreetMap tiles — no API key or token needed.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspaces --include-workspace-root
COPY tsconfig.base.json ./
COPY frontend/ frontend/
RUN npm run build -w @ecosphere/web

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
