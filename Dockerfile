# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
# @napi-rs/canvas ships prebuilt musl binaries; nothing to compile.
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build without requiring the runtime env vars (read via process.env at runtime).
ENV MONGODB_URI=mongodb://127.0.0.1:27017/quizforge
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy the minimal standalone server and its traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets (server.js serves these automatically when present).
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public assets (favicon etc.).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
