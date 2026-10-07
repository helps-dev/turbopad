#!/usr/bin/env bash
# ==============================================================================
# TurboPad VPS Deployment Script (PM2 Native Node.js)
# Usage: ./scripts/deploy-pm2.sh [branch]
# ==============================================================================

set -eo pipefail

BRANCH="${1:-main}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=================================================="
echo "  ◈ TurboPad PM2 Deployment Starting"
echo "  ◈ Project Directory: ${PROJECT_ROOT}"
echo "  ◈ Target Branch:     ${BRANCH}"
echo "=================================================="

cd "${PROJECT_ROOT}"

# 1. Verify Node and PM2 prerequisites
if ! command -v node &>/dev/null; then
  echo "❌ Error: Node.js is not installed."
  exit 1
fi

if ! command -v pm2 &>/dev/null; then
  echo "⚠️ PM2 not found globally; installing pm2 or checking local node_modules…"
  npm install -g pm2 || npm install pm2
fi

# 2. Backup SQLite database
if [ -f "data/turbopad.db" ]; then
  BACKUP_DIR="data/backups"
  mkdir -p "${BACKUP_DIR}"
  BACKUP_FILE="${BACKUP_DIR}/turbopad_$(date +%Y%m%d_%H%M%S).db"
  echo "📦 Backing up SQLite database to ${BACKUP_FILE}…"
  cp "data/turbopad.db" "${BACKUP_FILE}"
fi

# 3. Pull latest Git updates
if [ -d ".git" ]; then
  echo "📥 Fetching latest commits from origin/${BRANCH}…"
  git fetch origin "${BRANCH}"
  git checkout "${BRANCH}"
  git pull --rebase origin "${BRANCH}" || {
    echo "⚠️ Git pull rebase warning; continuing with local state."
  }
fi

# 4. Install production dependencies
echo "📦 Installing production dependencies…"
npm ci --omit=dev

# 5. Reload PM2 process
echo "🚀 Reloading PM2 process (zero-downtime)…"
if pm2 describe turbopad &>/dev/null; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

pm2 save

# 6. Verify health check
echo "⏳ Checking service health…"
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health || true)
if [ "${HTTP_CODE}" = "200" ]; then
  echo "✅ Health check PASSED: TurboPad API is live and responding 200 OK!"
else
  echo "⚠️ Health check returned HTTP ${HTTP_CODE}. Check logs with: pm2 logs turbopad"
fi

echo "=================================================="
echo "  🎉 TurboPad PM2 Reload Complete!"
echo "=================================================="
