#!/usr/bin/env bash
# ==============================================================================
# TurboPad VPS Deployment Script (Docker Compose)
# Usage: ./scripts/deploy-vps.sh [branch]
# ==============================================================================

set -eo pipefail

BRANCH="${1:-main}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=================================================="
echo "  ◈ TurboPad VPS Deployment Starting"
echo "  ◈ Project Directory: ${PROJECT_ROOT}"
echo "  ◈ Target Branch:     ${BRANCH}"
echo "  ◈ Timestamp:         $(date -u +"%Y-%m-%d %H:%M:%SZ")"
echo "=================================================="

cd "${PROJECT_ROOT}"

# 1. Verify Docker and Docker Compose prerequisites
if ! command -v docker &>/dev/null; then
  echo "❌ Error: Docker is not installed or not in PATH."
  echo "   Please install Docker first: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "❌ Error: 'docker compose' (v2 plugin) is not available."
  exit 1
fi

# 2. Backup SQLite database if data directory exists
if [ -f "data/turbopad.db" ]; then
  BACKUP_DIR="data/backups"
  mkdir -p "${BACKUP_DIR}"
  BACKUP_FILE="${BACKUP_DIR}/turbopad_$(date +%Y%m%d_%H%M%S).db"
  echo "📦 Backing up SQLite database to ${BACKUP_FILE}…"
  cp "data/turbopad.db" "${BACKUP_FILE}"
fi

# 3. Pull latest Git updates if in a git repository
if [ -d ".git" ]; then
  echo "📥 Fetching latest commits from origin/${BRANCH}…"
  git fetch origin "${BRANCH}"
  git checkout "${BRANCH}"
  git pull --rebase origin "${BRANCH}" || {
    echo "⚠️ Git pull rebase warning; continuing with local state."
  }
fi

# 4. Build and start containers
echo "🔨 Building TurboPad Docker container…"
docker compose build --pull turbopad

echo "🚀 Starting TurboPad and Nginx services…"
docker compose up -d --remove-orphans

# 5. Verify service health
echo "⏳ Waiting for TurboPad health check (http://127.0.0.1:3001/api/health)…"
MAX_ATTEMPTS=20
ATTEMPT=0
HEALTH_OK=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || true)
  if [ "${HTTP_CODE}" = "200" ]; then
    HEALTH_OK=true
    break
  fi
  echo "   Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: Status code ${HTTP_CODE}. Waiting 2s…"
  sleep 2
done

if [ "$HEALTH_OK" = true ]; then
  echo "✅ Health check PASSED: TurboPad API is live and responding 200 OK!"
else
  echo "❌ Health check timed out or failed. Displaying container logs:"
  docker compose logs --tail=40 turbopad
  exit 1
fi

# 6. Cleanup dangling Docker images to save VPS disk space
echo "🧹 Cleaning up dangling Docker images…"
docker image prune -f

echo "=================================================="
echo "  🎉 TurboPad Deployed Successfully!"
echo "  ◈ API Health:   http://localhost/api/health"
echo "  ◈ Container:    $(docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}')"
echo "=================================================="
