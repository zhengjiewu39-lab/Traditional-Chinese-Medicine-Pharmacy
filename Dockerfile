# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY server.js ./
COPY server ./server
COPY benchmarks ./benchmarks
COPY scripts ./scripts
COPY data/.gitkeep ./data/

ENV PORT=3002
ENV NODE_ENV=production
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3002/api/health || exit 1

CMD ["node", "server.js"]
