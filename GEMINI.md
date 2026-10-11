# FarmaYa AR - Georeferenced Pharmacy Tracker

FarmaYa AR is a NestJS-based backend system designed to track and georeference on-duty pharmacies in Argentina (initially focusing on the Jujuy province). It consumes the official Jujuy HTML listing and uses multi-source geocoding to provide accurate, real-time information about pharmacy availability.

## Project Overview

### Core Technologies
- **Framework:** NestJS (v11)
- **Language:** TypeScript
- **Architecture:** CQRS (Command Query Responsibility Segregation)
- **Database:** MongoDB (Mongoose)
- **Geocoding:** Official Argentina Georef API & Nominatim (OpenStreetMap) fallback
- **Parsing:** Axios and Cheerio (HTML)

### Main Architecture
The project follows a modular structure focused on separation of concerns:
- **Presentation Layer (`/src/presentation`):** REST controllers for pharmacies, scraping triggers, and community reports.
- **Application Layer (`/src/application`):** CQRS Command/Query handlers, HTML scraping, and geocoding services.
- **Infrastructure Layer (`/src/infrastructure`):** Database schemas, repositories, geocoding clients, and security services.
- **Domain Layer (`/src/domain`):** Core entities and repository interfaces.

## Building and Running

### Prerequisites
- Node.js (v20+)
- Docker and Docker Compose (for local MongoDB)

### Commands
- **Install Dependencies:** `pnpm install`
- **Start Infrastructure:** `pnpm infra:up` (Starts MongoDB via Docker)
- **Run Development Server:** `pnpm start:dev`
- **Build for Production:** `pnpm build`
- **Run Tests:** `pnpm test`
- **Check Coverage:** `pnpm test:cov`
- **Linting:** `pnpm lint`

## Development Conventions

### Official HTML Scraping
The system reads `turnosjujuy.com.ar`, discovers every locality from the HTML selector, submits the locality form, and maps structured rows directly into pharmacy records.
- **Service:** `TurnosJujuyScraperService`
- **Workflow:** HTML rows and embedded map coordinates -> typed pharmacy records -> geocoding fallback -> MongoDB upsert.

### Geocoding Strategy
- **Service:** `GeoRefService`
- **Provider 1:** Official Argentina Georef API (preferred for official street names).
- **Provider 2:** Nominatim (OSM) as a fallback for missing data.
- **Constraint:** Requests to Nominatim include a 1-second delay to respect rate limits.

### Data Persistence
- **Uniqueness:** Pharmacies are identified by a composite key of `name`, `city`, and `dutyUntil`. This allows tracking multiple shifts for the same pharmacy without data loss.
- **Geospatial:** The `Pharmacy` schema includes a `2dsphere` index on the `location` field for proximity searches.

### Agentic Workflow
This project follows a strict agentic development workflow defined in `AGENTS.md`. Every feature must go through:
1. Design & Core Logic
2. Persistence Mapping
3. Security Pass
4. Unit Testing (Mandatory)
5. E2E Integration
6. Final Code Review

### Testing Standards
- Unit tests are located alongside source files (`.spec.ts`).
- Mocking of external services (Axios and geocoding providers) is required.
- New features are incomplete without passing tests and coverage verification.

## Security and Authentication

### Authentication Flow
- **Google OAuth2:** The login flow is initiated at `/auth/google`. Upon successful authentication, the backend issues a **JWT** (signed with a secret key, valid for 7 days).
- **JWT Management:** Authenticated requests must include the token in the header: `Authorization: Bearer <token>`.
- **Frontend Integration:** After successful Google callback, the API redirects the user to `${FRONTEND_URL}/auth-success?token=<jwt>`.

### API Protection
- **Global Rate Limiting:** 100 requests per minute per IP.
- **Specific Rate Limiting:** Community reports are restricted to 3 submissions per 30 minutes per device/user.
- **Protected Routes:** Endpoints that modify data (like `/api/pharmacies/report`) require a valid JWT via `JwtAuthGuard`.

### Environment Variables (.env)
```env
MONGODB_URI=mongodb://localhost:27017/farmaya
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_secure_secret
```
