# Imagem base com Node.js
FROM node:18-slim

# Instala Chromium (necessário pro Puppeteer/whatsapp-web.js)
RUN apt-get update && apt-get install -y \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Define diretório de trabalho dentro do container
WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia todo o código do projeto
COPY . .

# Define caminho do Chromium para o Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expõe porta para health-check na Koyeb
EXPOSE 3000

# Comando que inicia o bot
CMD ["node", "chatbot.js"]
