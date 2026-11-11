FROM node:20-alpine AS builder
WORKDIR /app
COPY People4people/backend/package*.json ./
RUN npm ci
COPY People4people/backend/ ./
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY People4people/backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
