#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TurboPad Automated Deployment Script for VPS
# Supports both Docker Compose (default) and PM2 (native fallback)
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}        ◈ TurboPad Automated VPS Deployment          ${NC}"
echo -e "${BLUE}=====================================================${NC}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Check or initialize .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}[Notice] .env not found. Creating from .env.example...${NC}"
        cp .env.example .env
    else
        echo -e "${YELLOW}[Notice] Generating default .env file...${NC}"
        cat <<EOF > .env
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
EOF
    fi
fi

# 2. Determine Deployment Mode
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo -e "${GREEN}[Mode] Docker Compose detected.${NC}"
    
    echo -e "${BLUE}[1/3] Building and starting containers...${NC}"
    docker compose up -d --build --remove-orphans

    echo -e "${BLUE}[2/3] Waiting for service healthcheck...${NC}"
    ATTEMPTS=0
    MAX_ATTEMPTS=20
    HEALTHY=false

    while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
        STATUS=$(docker inspect --format='{{json .State.Health.Status}}' turbopad-app 2>/dev/null || echo "\"starting\"")
        if [ "$STATUS" = "\"healthy\"" ]; then
            HEALTHY=true
            break
        fi
        ATTEMPTS=$((ATTEMPTS+1))
        echo -e "Waiting for turbopad-app to be healthy... ($ATTEMPTS/$MAX_ATTEMPTS)"
        sleep 2
    done

    if [ "$HEALTHY" = true ]; then
        echo -e "${GREEN}✓ turbopad-app container is healthy!${NC}"
    else
        echo -e "${YELLOW}Warning: Container status is $STATUS. Checking logs:${NC}"
        docker compose logs --tail=30 turbopad-app
    fi

    echo -e "${BLUE}[3/3] Checking HTTP endpoint...${NC}"
    if command -v curl >/dev/null 2>&1; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/api/health || true)
        echo -e "HTTP Response on port 80: ${GREEN}$HTTP_CODE${NC}"
    fi

elif command -v pm2 >/dev/null 2>&1; then
    echo -e "${GREEN}[Mode] PM2 process manager detected.${NC}"

    echo -e "${BLUE}[1/3] Installing production dependencies...${NC}"
    npm ci --omit=dev --ignore-scripts

    echo -e "${BLUE}[2/3] Reloading PM2 processes...${NC}"
    pm2 startOrReload ecosystem.config.cjs --update-env

    echo -e "${BLUE}[3/3] PM2 process status:${NC}"
    pm2 status turbopad
else
    echo -e "${RED}[Error] Neither Docker Compose nor PM2 was found on this system.${NC}"
    echo "Please install Docker (docker compose) or PM2 (npm install -g pm2) to deploy TurboPad."
    exit 1
fi

echo -e "${BLUE}=====================================================${NC}"
echo -e "${GREEN}✓ TurboPad deployment completed successfully!${NC}"
echo -e "${BLUE}=====================================================${NC}"
