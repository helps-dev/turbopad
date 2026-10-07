# Multi-stage production build for TurboPad
FROM node:22-alpine AS base

# Install wget for container health check
RUN apk add --no-cache wget

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application server and pre-built static frontend
COPY server/ ./server/
COPY Web/dist/ ./Web/dist/

# Ensure persistent data directory exists and assign to node user
RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "server/index.js"]
