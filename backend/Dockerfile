FROM node:22-bookworm-slim AS base

RUN apt-get update && apt-get install -y \
    dcmtk \
    git \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    libasound2 \
    libxkbcommon0 \
    libcairo2 \
    libpango-1.0-0 \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

RUN mkdir -p /tmp/node/restore && \
    chown -R nodejs:nodejs /tmp/node/restore && \
    chmod -R 755 /tmp/node/restore

RUN mkdir -p /home/nodejs/.cache/puppeteer && \
    chown -R nodejs:nodejs /home/nodejs

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_CACHE_DIR=/home/nodejs/.cache/puppeteer

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN chown -R nodejs:nodejs /app
USER nodejs
RUN npx puppeteer browsers install chrome

WORKDIR /app

EXPOSE 3000

CMD ["node", "server.js"]