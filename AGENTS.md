# Agentic Development Workflow (NestJS)

This project uses a multi-agent architectural approach to guarantee high code quality, security, and test coverage. When interacting with this codebase using an AI assistant, use the roles defined in `./agentic-rules/` according to the current phase of development.

## Core Development Philosophy

1. **Test-Driven / Test-Mandatory:** No feature is considered complete without its corresponding unit and E2E tests.
2. **SOLID & Clean Architecture:** We separate concerns strictly. Controllers route, Services process, Repositories persist.
3. **Security First:** Endpoints are closed by default and require explicit authorization rules.

## The Workflow Pipeline

Follow this sequence for every new feature or refactor:

### Phase 1: Design & Core Logic (`nestjs-backend-development-expert`)

- Define DTOs, interfaces, and the core domain logic.
- Scaffold the Module, Controller, and Service.
- **Rule:** Keep everything strictly typed and modular.

### Phase 2: Persistence (`nestjs-database-expert`)

- Map the entities and create the database migrations.
- Implement complex queries using the Repository pattern.
- **Rule:** Prevent N+1 issues and ensure transactional safety.

### Phase 3: Security Pass (`nestjs-security-expert`)

- Apply authentication/authorization Guards to the new controllers.
- Validate payload structure strictly with `class-validator`.
- **Rule:** Never trust user input.

### Phase 4: Unit Testing (`nestjs-unit-testing-expert`)

- Write isolated `.spec.ts` files for the services and controllers.
- Mock all injected dependencies.
- **Rule:** Ensure all edge cases and exception throws are tested.

### Phase 5: E2E Integration (`nestjs-testing-expert`)

- Write `.e2e-spec.ts` simulating HTTP requests against the feature.
- Verify that guards, interceptors, and database interactions work together.

### Phase 6: Final Review (`nestjs-code-review-expert`)

- Review the entire pull request/changeset.
- Enforce naming conventions, DRY principles, and identify code smells.
- **Rule:** If the review fails, go back to Phase 1.

## Instructions for AI Assistants

When asked to implement a feature, implicitly run through this pipeline. Start by providing the architecture (Phase 1 & 2), then immediately provide the tests (Phase 4 & 5). Ensure security best practices are applied at all times.
