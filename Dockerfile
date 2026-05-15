# syntax=docker/dockerfile:1.7
# =============================================================================
# OpenKPI Studio — production image
# =============================================================================
# Multi-stage build for a slim final image (~150MB).
# Uses Next.js standalone output (set in next.config.js).
# Non-root runtime user. No build-time secrets — runtime env is injected
# by docker-compose from the server's .env file.
# =============================================================================

# ─── Stage 1: deps ───────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ─── Stage 2: build ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─── Stage 3: runtime ────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates dumb-init wget \
    && rm -rf /var/lib/apt/lists/*

# Next.js standalone output is fully self-contained (server.js + minimum
# node_modules). We also copy the public/ folder and the static assets.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
