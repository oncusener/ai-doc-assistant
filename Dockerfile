# --- build -------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
RUN npm run build

# --- runtime -----------------------------------------------------------------
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev -w server && npm cache clean --force
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
COPY samples samples
# Writable locations for the embedded database and the embedding model cache.
ENV DATA_DIR=/app/data MODEL_CACHE_DIR=/models
RUN mkdir -p /app/data /models && chown -R node:node /app/data /models
EXPOSE 8787
USER node
CMD ["node", "server/dist/index.js"]
