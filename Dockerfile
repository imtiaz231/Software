# --- Stage 1: React frontend build ---
FROM node:22-bookworm-slim AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --no-audit --no-fund
COPY client ./
RUN npm run build        # output -> /app/server/public

# --- Stage 2: Node server ---
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server ./
COPY --from=client /app/server/public ./public
ENV NODE_ENV=production PORT=4000 DATA_DIR=/data TZ=Asia/Karachi
VOLUME ["/data"]
EXPOSE 4000
CMD ["node", "src/index.js"]
