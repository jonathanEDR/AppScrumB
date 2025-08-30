# Copilot Instructions for AppScrum Backend

## Project Overview
- **Purpose:** RESTful API backend for AppScrum, managing authentication, users, Scrum artifacts (backlog, sprints, releases, etc.), and business logic for agile teams.
- **Stack:** Node.js, Express, (DB: see config/database.js), Clerk (for authentication, see config/clerkConfig.js).

## Architecture & Key Patterns
- **Entry Point:** `server.js` initializes Express, middleware, and routes.
- **Config:** All configuration (DB, Clerk, etc.) is in `config/`.
- **Models:** Data models in `models/` (one file per entity, e.g., `BacklogItem.js`, `Sprint.js`).
- **Routes:** API endpoints in `routes/` (grouped by domain, e.g., `sprints.js`, `users.js`).
- **Services:** Business logic in `services/` (e.g., `developersService.js`, `repositoryService.js`).
- **Middleware:** Auth, validation, and custom logic in `middleware/` (see `authenticate.js`, `validation/`).
- **Uploads:** File uploads (e.g., bug reports) in `uploads/`.

## Developer Workflows
- **Install:** `npm install`
- **Run:** `npm start` (uses port from `.env`)
- **Test connectivity:** See scripts in `scripts/` (e.g., `test-connectivity.js`, `test-user-integration.js`).
- **Debug:** Use VS Code or Node.js debugger; main entry is `server.js`.
- **Environment:** Copy `.env.example` to `.env` and fill required values.

## Project-Specific Conventions
- **Validation:** All input validation is handled via middleware in `middleware/validation/`.
- **Authentication:** Uses Clerk (see `config/clerkConfig.js` and `middleware/authenticate.js`).
- **Service Pattern:** Route handlers are thin; business logic is in `services/`.
- **Modularity:** Each domain (e.g., backlog, sprints, users) has its own model, route, and (if needed) service.
- **Error Handling:** Centralized via Express error middleware (see `middleware/`).

## Integration & External Dependencies
- **Clerk:** For authentication (see config and middleware).
- **Database:** Configured in `config/database.js` (DB type may vary; check file for details).
- **Scripts:** Utility and diagnostic scripts in `scripts/`.

## Examples
- **Add a new entity:** Create a model in `models/`, a service in `services/`, and a route in `routes/`.
- **Add validation:** Place logic in `middleware/validation/` and use as middleware in the route.
- **Add a new API endpoint:** Define in the relevant file in `routes/`, delegate logic to a service.

## References
- See `README.md` for setup and usage.
- See `config/` for environment and integration details.
- See `scripts/` for connectivity and diagnostic tools.

---
_Keep instructions concise and up-to-date. Update this file if project structure or conventions change._
