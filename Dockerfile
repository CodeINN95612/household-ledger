# syntax=docker/dockerfile:1

# Debian slim (glibc + OpenSSL 3) — the smooth path for Prisma engines.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate
WORKDIR /app

# ---- All dependencies (for building) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Build the app and compile the seed to plain JS ----
FROM base AS build
# Placeholder values: the build never connects to the DB or signs tokens, but
# importing the Prisma/Auth modules during tracing wants the env vars present.
ENV DATABASE_URL="file:/tmp/build.db"
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build
# Compile the TypeScript seed so the runtime image needs no tsx/typescript.
RUN pnpm exec tsc prisma/seed.ts \
      --module commonjs --target es2022 --moduleResolution node \
      --esModuleInterop --skipLibCheck --outDir prisma-dist

# ---- Production dependencies only ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- Runtime image ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma-dist ./prisma-dist

# Generate the Prisma client against the production node_modules.
RUN pnpm prisma generate

COPY docker-entrypoint.sh ./
# Normalize line endings (in case of CRLF on Windows) and make executable.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "start"]
