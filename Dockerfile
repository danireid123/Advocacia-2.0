# =========================================================================
# ADVOCACIA STUDIO PRO v2.0 - DOCKERFILE MULTI-ARCH (x86_64 / ARM64)
# Otimizado para Oracle Cloud Always Free (Ampere A1 ARM), AWS, DigitalOcean
# =========================================================================

FROM node:20-bullseye-slim

# Evita prompts interativos durante apt-get
ENV DEBIAN_FRONTEND=noninteractive

# Instala Chromium e dependências essenciais do Puppeteer no Linux
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libasound2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Informa ao puppeteer para utilizar o Chromium do sistema operacional
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Instala dependências de produção primeiro (aproveitamento de cache Docker)
COPY package*.json ./
RUN npm install --omit=dev

# Copia os arquivos da aplicação
COPY . .

# Cria diretórios de persistência
RUN mkdir -p /app/wwebjs_auth_session_v2 /app/cache

# Volume de persistência da sessão do WhatsApp e configurações
VOLUME ["/app/wwebjs_auth_session_v2", "/app/cache"]

EXPOSE 3000

# Health check automático do container
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["npm", "run", "server"]
