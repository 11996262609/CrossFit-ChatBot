FROM node:20-bullseye

# Dependências do Chrome
RUN apt-get update && apt-get install -y \
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
COPY package*.json ./
RUN npm ci --omit=dev

# Baixa o Chrome do Puppeteer (fica em /root/.cache/puppeteer/...)
RUN npx puppeteer browsers install chrome

COPY . .
ENV NODE_ENV=production
ENV PORT=3000
ENV WWEBJS_DATA_PATH=/data/wwebjs_auth

EXPOSE 3000
CMD ["node","chatbot.js"]
