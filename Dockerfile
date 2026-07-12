# --- Build stage ---
FROM oven/bun:1.3.14 AS build
WORKDIR /app

# Install deps (root workspace so packages/web resolves correctly)
COPY package.json bun.lock ./
COPY packages/web/package.json packages/web/package.json
COPY packages/mobile/package.json packages/mobile/package.json
COPY packages/desktop/package.json packages/desktop/package.json
RUN bun install --frozen-lockfile

COPY . .

# Build the web frontend (outputs to packages/web/dist)
WORKDIR /app/packages/web
RUN bun run build

# --- Runtime stage ---
FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app

# Only what's needed to run the Bun server + serve the built frontend
COPY --from=build /app/packages/web/dist ./packages/web/dist
COPY --from=build /app/packages/web/src/server.ts ./packages/web/src/server.ts
COPY --from=build /app/packages/web/src/api ./packages/web/src/api
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/web/node_modules ./packages/web/node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/web/package.json ./packages/web/package.json

ENV NODE_ENV=production
# Cloud Run injects PORT; server.ts reads process.env.PORT (defaults to 3000)
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/packages/web
CMD ["bun", "src/server.ts"]
