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
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --include=dev --legacy-peer-deps
# Prisma client must be generated against the schema before next build.
RUN npx prisma generate

# ─── Stage 2: build ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Stage 3: runtime ────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates dumb-init wget openssl \
    && rm -rf /var/lib/apt/lists/*

# Next.js standalone output is fully self-contained (server.js + minimum
# node_modules). We also copy the public/ folder and the static assets.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Prisma engine binary + schema for runtime migrations / queries.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/prisma ./prisma

USER node
EXPOSE 3000

# Probe the seeded demo page (final destination of the / → /w/demo redirect).
# wget exits 8 on 3xx without --max-redirect, so --spider on the destination.
HEALTHCHECK --interval=30s --timeout=8s --start-period=25s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/w/demo || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
