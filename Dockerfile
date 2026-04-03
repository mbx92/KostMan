# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++ libc6-compat

# Stage 2: Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Stage 3: Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Nuxt application
RUN npm run build

# Stage 4: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime dependencies for better-sqlite3 and native modules copied from deps
RUN apk add --no-cache libc6-compat

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxtjs

# Copy runtime dependencies for migration runner
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nuxtjs:nodejs /app/.output ./.output
COPY --from=builder --chown=nuxtjs:nodejs /app/server/database/migrations ./server/database/migrations
COPY --from=builder --chown=nuxtjs:nodejs /app/scripts/run-migrations.mjs ./scripts/run-migrations.mjs
COPY --from=builder --chown=nuxtjs:nodejs /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN chmod +x ./scripts/docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

# Switch to non-root user
USER nuxtjs

# Expose port
EXPOSE 3000

# Run migrations, then start the application
CMD ["/app/scripts/docker-entrypoint.sh"]
