FROM node:20-bullseye

# Dependências necessárias para Chrome headless
RUN apt-get update && apt-get install -y \
  ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
  libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
  libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxshmfence1 libxtst6 \
  wget xdg-utils && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala somente dependências (produção)
COPY package*.json ./
RUN npm ci --omit=dev

# Baixa o Chrome gerenciado pelo Puppeteer (compatível)
RUN npx puppeteer browsers install chrome

# Copia o código
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
# Caminho que vamos montar como volume para persistir a sessão do WhatsApp
ENV WWEBJS_DATA_PATH=/data/wwebjs_auth

EXPOSE 3000
CMD ["node","chatbot.js"]
