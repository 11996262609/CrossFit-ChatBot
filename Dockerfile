# ---- Build env
FROM node:18-slim

# 1) Dependências do Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxtst6 \
    libxcursor1 \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 2) Aponta o path do Chromium para o puppeteer-core usado pelo whatsapp-web.js
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 3) Diretório do app
WORKDIR /app

# 4) Instala só deps
COPY package*.json ./
RUN npm ci --only=production

# 5) Copia código
COPY . .

# 6) Porta do health-check
EXPOSE 3000

# 7) Start
CMD ["npm", "start"]
