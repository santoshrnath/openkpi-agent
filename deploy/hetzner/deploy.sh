#!/usr/bin/env bash
# =============================================================================
# OpenKPI Studio — Hetzner one-shot deploy
# =============================================================================
# Run from the project root on your laptop:
#
#   OPENKPI_SSH_HOST=root@1.2.3.4 ./deploy/hetzner/deploy.sh
#
# Optional overrides:
#   OPENKPI_PORT=3050              host port on the server
#   OPENKPI_ENV_FILE=.env.local    where the secrets live on your laptop
#   REMOTE_DIR=/opt/openkpi-studio target dir on the server
#
# What it does:
#   1. rsyncs the project to /opt/openkpi-studio on the server
#      — excludes node_modules, .next, .git, and all .env* files
#   2. scp's your local .env.local to the server as .env
#      — this is where the secrets land; never touches git
#   3. runs `docker compose up -d --build` on the server
#   4. prints the public URL
# =============================================================================
set -euo pipefail

: "${OPENKPI_SSH_HOST:?Set OPENKPI_SSH_HOST=user@ip (e.g. root@1.2.3.4)}"
OPENKPI_PORT="${OPENKPI_PORT:-3050}"
OPENKPI_ENV_FILE="${OPENKPI_ENV_FILE:-.env.local}"
REMOTE_DIR="${REMOTE_DIR:-/opt/openkpi-studio}"

if [ ! -f "$OPENKPI_ENV_FILE" ]; then
  echo "✗ Missing env file at $OPENKPI_ENV_FILE" >&2
  echo "  Copy .env.example to .env.local and fill in ANTHROPIC_API_KEY at minimum." >&2
  exit 1
fi

echo "→ Project: openkpi-studio"
echo "→ Target:  $OPENKPI_SSH_HOST:$REMOTE_DIR"
echo "→ Port:    $OPENKPI_PORT"
echo

echo "▸ rsync to server (excluding node_modules / .next / .env*)"
ssh "$OPENKPI_SSH_HOST" "mkdir -p $REMOTE_DIR"
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude ".env*" \
  --exclude "*.tsbuildinfo" \
  ./ "$OPENKPI_SSH_HOST:$REMOTE_DIR/"

echo "▸ writing .env on server (from $OPENKPI_ENV_FILE)"
scp "$OPENKPI_ENV_FILE" "$OPENKPI_SSH_HOST:$REMOTE_DIR/.env"

echo "▸ docker compose up -d --build"
ssh "$OPENKPI_SSH_HOST" \
  "cd $REMOTE_DIR && OPENKPI_PORT=$OPENKPI_PORT docker compose up -d --build"

HOST_IP="${OPENKPI_SSH_HOST#*@}"
PUBLIC_HOST=$(grep -E '^PUBLIC_HOSTNAME=' "$OPENKPI_ENV_FILE" | head -n1 | cut -d= -f2-)
PUBLIC_HOST="${PUBLIC_HOST:-openstudio.oneplaceplatform.com}"

echo
echo "✓ Deployed."
echo "  Public (via Traefik): https://${PUBLIC_HOST}"
echo "  Direct (smoke test):  http://${HOST_IP}:${OPENKPI_PORT}"
echo
echo "  Tail logs with:  ssh ${OPENKPI_SSH_HOST} 'cd ${REMOTE_DIR} && docker compose logs -f'"
