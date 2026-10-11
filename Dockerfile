# Fase 1: Construcción
FROM node:20-slim AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Instalar todas las dependencias (incluyendo devDependencies para construir)
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate && pnpm install --frozen-lockfile

# Copiar el resto del código
COPY . .

# Construir la aplicación NestJS
RUN pnpm build

# Fase 2: Ejecución (Runtime)
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Copiar solo lo necesario desde la fase de construcción
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/dist ./dist

# Instalar solo dependencias de producción
RUN corepack enable && corepack prepare pnpm@12.9.1 --activate && pnpm install --prod --frozen-lockfile

# Definir variables de entorno
ENV PORT=8080
ENV NODE_ENV=production

# Exponer el puerto
EXPOSE 8080

# Comando para iniciar la aplicación
CMD ["node", "dist/main"]
