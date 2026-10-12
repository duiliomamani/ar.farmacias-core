# CondorJUY — core

API NestJS 11 para servicios esenciales de Jujuy, scraping oficial HTML de farmacias, geocodificación, persistencia y feedback.

La documentación completa está en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Responsabilidades

- Exponer consultas geográficas y por fecha/localidad.
- Scrappear `turnosjujuy.com.ar` mediante HTML y `application/x-www-form-urlencoded`.
- Extraer coordenadas publicadas en enlaces de Google Maps y puntos del HTML.
- Validar nombres, direcciones, source IDs y coordenadas.
- Guardar turnos diarios y permanentes en MongoDB.
- Limpiar turnos viejos y duplicados al repetir el scraping.
- Geocodificar como fallback con Google Geocoding y Nominatim.
- Validar feedback con Cloudflare Turnstile.
- Aplicar rate limiting y validación de origen.
- Notificar por Telegram de forma opcional.

## Stack

- NestJS 11 + TypeScript
- CQRS
- MongoDB + Mongoose
- Axios + Cheerio
- `class-validator`
- pnpm

## Instalación

```bash
pnpm install
```

Crear `.env`:

```env
MONGODB_URI=mongodb://admin:password@localhost:27017/farmaya?authSource=admin
FRONTEND_URL=http://localhost:3000
PORT=5001

# Scraper programado
CRON_SECRET=

# Turnstile
TURNSTILE_SECRET_KEY=...
TURNSTILE_HOSTNAMES=localhost,127.0.0.1

# Opcional
GOOGLE_MAPS_API_KEY=
TELEGRAM_BOT_TOKEN=
FEEDBACK_CHAT_ID=
```

Iniciar:

```bash
pnpm start:dev
```

La API queda disponible en `http://localhost:5001`.

## Endpoints

```text
GET  /health
GET  /api/pharmacies/nearby
GET  /api/pharmacies/by-date
GET  /api/scraping/turnos-jujuy/status
GET  /api/scraping/turnos-jujuy
POST /api/feedback
OPTIONS /api/feedback
```

El trigger del scraper acepta `x-auth-token: Bearer <CRON_SECRET>` cuando `CRON_SECRET` está configurado.

## Pruebas

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```

No forman parte del sistema actual los módulos de JWT/Google OAuth, scraper de PDF ni `ai-normalizer`.
