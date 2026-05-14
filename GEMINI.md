# FarmaYa AR - Georeferenced Pharmacy Tracker

FarmaYa AR is a NestJS-based backend system designed to track and georeference on-duty pharmacies in Argentina (initially focusing on the Jujuy province). It leverages AI-driven OCR text normalization and multi-source geocoding to provide accurate, real-time information about pharmacy availability.

## Project Overview

### Core Technologies
- **Framework:** NestJS (v11)
- **Language:** TypeScript
- **Architecture:** CQRS (Command Query Responsibility Segregation)
- **Database:** MongoDB (Mongoose)
- **AI Integration:** Google Gemini API (`@google/genai`) for text normalization
- **Geocoding:** Official Argentina Georef API & Nominatim (OpenStreetMap) fallback
- **Parsing:** Cheerio (HTML), pdf-parse (PDF)

### Main Architecture
The project follows a modular structure focused on separation of concerns:
- **Presentation Layer (`/src/presentation`):** REST controllers for pharmacies, scraping triggers, and community reports.
- **Application Layer (`/src/application`):** CQRS Command/Query handlers and high-level services like AI normalization and geocoding.
- **Infrastructure Layer (`/src/infrastructure`):** Database schemas, repositories, external scrapers (Colfarjuy), and security services.
- **Domain Layer (`/src/domain`):** Core entities and repository interfaces.

## Building and Running

### Prerequisites
- Node.js (v20+)
- Docker and Docker Compose (for local MongoDB)
- Gemini API Key (set in `.env` as `GEMINI_API_KEY`)

### Commands
- **Install Dependencies:** `npm install`
- **Start Infrastructure:** `npm run infra:up` (Starts MongoDB via Docker)
- **Run Development Server:** `npm run start:dev`
- **Build for Production:** `npm run build`
- **Run Tests:** `npm run test`
- **Check Coverage:** `npm run test:cov`
- **Linting:** `npm run lint`

## Development Conventions

### AI-Driven Normalization
The system uses the Gemini API to parse unstructured text from pharmacy schedules (often visual grids or collapsed OCR text).
- **Service:** `AiNormalizerService`
- **Workflow:** Raw text -> Gemini Prompt -> JSON Array (validated with Zod 4).
- **Optimization:** Data is processed in 7-day chunks to avoid model output token limits.

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
- Mocking of external services (Axios, Gemini) is required.
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
GEMINI_API_KEY=your_key
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_secure_secret
```
