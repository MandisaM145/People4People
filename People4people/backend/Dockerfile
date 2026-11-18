FROM node:20-alpine AS builder
WORKDIR /workspace
COPY . .
RUN set -eu; \
    if [ -f /workspace/People4people/backend/package.json ]; then APP_DIR=/workspace/People4people/backend; \
    elif [ -f /workspace/backend/package.json ]; then APP_DIR=/workspace/backend; \
    elif [ -f /workspace/package.json ]; then APP_DIR=/workspace; \
    else echo "Backend package.json not found in Docker build context" >&2; exit 1; fi; \
    cd "$APP_DIR"; \
    npm ci; \
    npm run build; \
    mkdir -p /build; \
    cp package.json package-lock.json /build/; \
    cp -R dist /build/dist

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /build/package.json /build/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /build/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
