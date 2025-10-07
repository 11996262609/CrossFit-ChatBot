FROM node:20-bullseye

# 1) Instala o Chromium do sistema e libs necessárias
RUN apt-get update && apt-get install -y \
  chromium \
  ca-certificates wget xdg-utils \
  fonts-liberation \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 \
  libcups2 libdbus-1-3 libdrm2 libexpat1 \
  libgbm1 libglib2.0-0 libgtk-3-0 \
  libnspr4 libnss3 libu2f-udev libvulkan1 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
  libxkbcommon0 libxrandr2 libxrender1 libxshmfence1 \
  libxss1 libxtst6 \
  libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2) Instala dependências do Node (sem dev)
COPY package*.json ./
RUN npm ci --omit=dev

# ❌ IMPORTANTE: NÃO baixe o Chrome do Puppeteer.
# (se você tinha uma linha "npx puppeteer browsers install chrome", REMOVA-A)

# 3) Copia o código
COPY . .

# 4) Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=8000
ENV WWEBJS_DATA_PATH=/data/session

# 👉 Aponta o Puppeteer para o Chromium do sistema e pula downloads
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

EXPOSE 8000
CMD ["node","chatbot.js"]
