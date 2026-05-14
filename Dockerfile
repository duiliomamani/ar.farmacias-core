# Fase 1: Construcción
FROM node:20-slim AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para construir)
RUN npm install

# Copiar el resto del código
COPY . .

# Construir la aplicación NestJS
RUN npm run build

# Fase 2: Ejecución (Runtime)
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Instalar dependencias necesarias para Playwright y utilidades de sistema
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copiar solo lo necesario desde la fase de construcción
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Instalar solo dependencias de producción
RUN npm install --omit=dev

# Instalar Chromium de Playwright y sus dependencias de sistema
# Usamos npx playwright install para que descargue el binario correcto para la versión de playwright-core
RUN npx playwright install --with-deps chromium

# Limpiar cache de apt para reducir tamaño de imagen
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Definir variables de entorno
ENV PORT=8080
ENV NODE_ENV=production

# Exponer el puerto
EXPOSE 8080

# Comando para iniciar la aplicación
CMD ["node", "dist/main"]
