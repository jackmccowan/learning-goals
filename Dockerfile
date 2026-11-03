# syntax=docker/dockerfile:1

# ---- deps: install every dependency, including dev tools ----
FROM node:24-bookworm-slim AS deps
# The Prisma CLI's schema engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
# Skip postinstall here: the Prisma schema isn't copied yet, so generate runs below.
RUN npm ci --ignore-scripts

# ---- builder: generate the Prisma client and build Next.js ----
FROM deps AS builder
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- migrator: one-shot job that applies migrations and seeds the database ----
FROM builder AS migrator
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# ---- runner: the small production image, with no dev tools or source code ----
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# The standalone folder holds server.js and only the node_modules it needs.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# The official image's built-in unprivileged user.
USER node
EXPOSE 3000
CMD ["node", "server.js"]
