# Issue #423: TDD plan — Published backend/proxy package

**Parent:** [README.md](./README.md)

---

## Overview

This document enumerates the **Test-Driven Development** plan for delivering a published backend/proxy package (e.g. `@signal-meaning/voice-agent-backend`) with a programmatic API and/or CLI. All work follows the project rule: **tests first (RED), then minimal implementation (GREEN), then refactor (REFACTOR).**

**Goal:** Consumers (e.g. voice-commerce) can depend on the package and mount `/api/deepgram/proxy`, `/api/openai/proxy`, and function-call with a thin wrapper (config, auth, logging).

---

## Current state (baseline)

- **Test-app:** `test-app/` — React demo app and our reference consumer; it runs a backend (see below) to serve the UI and proxy/function-call endpoints. Today that backend is a single custom server.
- **Backend server:** `test-app/scripts/backend-server.js` — Express server with Deepgram proxy, OpenAI proxy, function-call endpoint, and test-app-specific routes (static, API for the test-app UI).
- **OpenAI proxy:** `scripts/openai-proxy/` — Standalone proxy server (`server.ts`, `cli.ts`, `run.ts`) with WebSocket translation and optional CLI.
- **No published package:** No npm (or similar) package today; each consumer would copy or fork the scripts.

**TDD scope:** Define the **public contract** of the new package via tests first; then extract or refactor existing code into the package so those tests pass.

---

## Phase 1: Package contract and programmatic API

**Goal:** The package exports a well-defined programmatic API. Tests define the contract before implementation.

### 1.1 RED — Contract tests (exports and signatures)

**Location:** e.g. `packages/voice-agent-backend/tests/api-contract.test.ts` (or `tests/voice-agent-backend-api.test.ts` if the package lives in-repo initially).

1. **Write failing tests** that assert:
   - The package has a main (or `module`) entry that exports the public API.
   - **Programmatic API (minimum):**
     - A function or factory to **create a server** (or mount routes on an existing app). Example: `createServer(options)` or `mountVoiceAgentBackend(app, options)`.
     - Options include at least: config for Deepgram proxy URL/behavior, OpenAI proxy URL/behavior, function-call handler or route path, and optional logging.
   - If the API returns a server: it exposes the expected routes (e.g. a way to register or discover `/api/deepgram/proxy`, `/api/openai/proxy`, and a function-call route).
   - If the API mounts on an existing app: it accepts an Express (or compatible) app and mounts the same routes.
2. Run tests → **RED** (package or exports do not exist yet).

### 1.2 GREEN — Minimal implementation

1. Create package layout (e.g. `packages/voice-agent-backend/` or new repo) with `package.json`, main entry, and stub exports that match the tested signatures.
2. Implement minimal behavior: e.g. `createServer(options)` returns an Express app with the three route groups mounted (Deepgram proxy, OpenAI proxy, function-call). Implementation may delegate to existing `backend-server` and `openai-proxy` logic (in-process or subprocess) so behavior is unchanged.
3. Run tests → **GREEN**.

### 1.3 REFACTOR

- Extract shared types and options into a clear public API surface.
- Ensure no test-app–specific routes leak into the package; the package exposes only the three mount points (and any agreed health or readiness endpoints).

**Deliverables:** Package with programmatic API; contract tests passing; API documented (e.g. README or JSDoc).

---

## Phase 2: Mountable routes behavior (integration tests)

**Goal:** The mounted routes behave like the current backend-server and openai-proxy. Tests define expected behavior before or while refactoring.

### 2.1 RED — Integration tests (route behavior)

**Location:** e.g. `packages/voice-agent-backend/tests/integration/mount-routes.test.ts` or repo `tests/integration/voice-agent-backend-routes.test.ts`.

1. **Write failing tests** that:
   - Start a server using the package API (or mount on a test app) with test config (mock upstream URLs or in-process mocks).
   - **Deepgram proxy:** Assert that a request to the mounted Deepgram proxy path (e.g. `POST /api/deepgram/proxy` or the path the package assigns) is accepted and, where applicable, forwards to a configured upstream or returns a defined response shape (e.g. upgrade for WebSocket, or 4xx when misconfigured).
   - **OpenAI proxy:** Same idea for the OpenAI proxy path (e.g. WebSocket or HTTP according to current openai-proxy behavior).
   - **Function-call:** POST to the function-call route with a valid payload (per Issue #407 contract); assert response shape or delegation to a provided handler.
2. Run tests → **RED** if route behavior is not yet implemented or does not match current backend-server/openai-proxy behavior.

### 2.2 GREEN — Implementation

1. Wire the package implementation to the existing backend-server and openai-proxy logic (or in-process equivalents) so that the mounted routes satisfy the integration tests.
2. Run tests → **GREEN**.

### 2.3 REFACTOR

- Share or reuse request/response types with the rest of the repo.
- Ensure config (env, options) is consistent and documented.

**Deliverables:** Integration tests passing; mounted routes behave like current implementation.

---

## Phase 3: CLI (optional but recommended)

**Goal:** The package provides a CLI (e.g. `voice-agent-backend serve`) for standalone or dev use. Tests define CLI behavior first.

### 3.1 RED — CLI tests

**Location:** e.g. `packages/voice-agent-backend/tests/cli.test.ts`.

1. **Write failing tests** that:
   - Invoke the CLI (e.g. `node dist/cli.js serve` or `npx voice-agent-backend serve`) with required env or flags.
   - Assert process starts and the server listens on a configured port (or default).
   - Optionally: assert that the same routes as the programmatic API are available (e.g. GET /health or a simple request to the proxy path returns expected status).
2. Run tests → **RED** if CLI does not exist or does not start the server.

### 3.2 GREEN — CLI implementation

1. Add CLI entry in `package.json` (`bin` field) and implement the `serve` (or equivalent) command that creates the server via the same programmatic API and starts listening.
2. Run tests → **GREEN**.

### 3.3 REFACTOR

- Reuse options/config between programmatic API and CLI (single source of truth).
- Document CLI usage in package README.

**Deliverables:** CLI that starts the backend with the same routes; CLI tests passing.

---

## Phase 4: Thin-wrapper consumer scenario (E2E or integration)

**Goal:** Demonstrate that a consumer can depend on the package and implement only a thin wrapper. Tests encode the “thin wrapper” scenario.

**Acceptance criterion:** The test-app must employ the thin wrapper. It is our simple consumer: its backend must depend on the published package and mount the package's routes (config, auth, logging only); no custom proxy or function-call logic in the test-app backend.

### 4.1 RED — Consumer scenario test

**Location:** e.g. `tests/integration/voice-agent-backend-thin-wrapper.test.ts` or E2E in `test-app/tests/e2e/`.

1. **Write failing tests** that:
   - Use the package as a dependency (e.g. `require('@signal-meaning/voice-agent-backend')` or equivalent).
   - Create a minimal “app” that: (a) creates an Express app, (b) applies only config (e.g. env), auth middleware (e.g. a simple stub that sets a header or rejects unauthenticated), and logging middleware, (c) mounts the package’s routes via the programmatic API, (d) does not implement any proxy or function-call logic itself.
   - Assert that a request through the thin wrapper (e.g. to `/api/openai/proxy` or function-call) is handled by the package and returns or behaves as in Phase 2 (auth and logging applied by the wrapper).
2. Run tests → **RED** if the package cannot be used this way (e.g. missing exports, or routes not mountable on an external app).

### 4.2 GREEN — Implementation

1. Adjust the package API if needed so that a consumer can pass an existing app and optional auth/logging; ensure the package only adds routes and does not require the consumer to duplicate proxy logic.
2. Run tests → **GREEN**.

### 4.3 REFACTOR

- Document the thin-wrapper pattern in the package README (and optionally in `docs/` for voice-commerce).

**Deliverables:** Thin-wrapper integration test passing; docs for consumers.

---

## Phase summary

| Phase | Focus | Key tests (RED first) | Deliverable |
|-------|--------|------------------------|-------------|
| 1 | Package contract & programmatic API | Export shape; createServer/mount API; options | Package with public API; contract tests |
| 2 | Mountable routes behavior | Integration: Deepgram proxy, OpenAI proxy, function-call routes | Routes behave like current backend/proxy |
| 3 | CLI | CLI starts server; routes available | CLI entry; CLI tests |
| 4 | Thin-wrapper consumer | Consumer app mounts package; only config, auth, logging | Thin-wrapper test; consumer docs |

---

## TDD rules (reminder)

- **RED:** Write failing tests that define the desired behavior before implementation.
- **GREEN:** Implement the minimum necessary to make those tests pass.
- **REFACTOR:** Improve structure and docs while keeping tests green.
- **No implementation** of new API surface or routes without tests first.

---

## Dependencies and order

- Phase 1 must be done first (package and API contract).
- Phase 2 can overlap with Phase 1.2/1.3 once the API exists (integration tests may need a real or mock server from the API).
- Phase 3 depends on Phase 1 (CLI uses the same API).
- Phase 4 depends on Phase 1 and Phase 2 (thin wrapper uses the API and relies on route behavior).

---

## Progress tracking

Update this section as phases are completed (e.g. “Phase 1.1 RED: Done”; “Phase 1.2 GREEN: Done”).

| Phase | RED | GREEN | REFACTOR |
|-------|-----|-------|----------|
| 1. Package contract | ✅ | ✅ | ✅ |
| 2. Mountable routes | ✅ | ✅ | ✅ |
| 3. CLI | ✅ | ✅ | ✅ |
| 4. Thin-wrapper | ✅ | ✅ | ✅ |

**Phase 4 done:** Thin-wrapper integration test in `tests/integration/voice-agent-backend-thin-wrapper.test.ts`; minimal app with auth/logging stubs mounts package and handles request.

**Phase 5 done:** Real function-call in package and test-app thin wrapper. Package now supports `functionCall.execute(name, args) => { content? } | { error? }` in `createServer`/`mountVoiceAgentBackend`, and exports `createFunctionCallHandler(options)` for raw Node HTTP. Test-app backend delegates POST /function-call to the package via `createFunctionCallHandler({ execute: executeFunctionCall })`; test-app provides config, auth, logging and the handler implementation only. Deepgram and OpenAI proxy routes remain in test-app for now (to be moved into package in a follow-up).

**Phase 3 done:** CLI at `packages/voice-agent-backend/src/cli.js` (serve command, respects PORT); integration test in `tests/integration/voice-agent-backend-cli.test.ts`; bin and README updated.

**Phase 2 done:** Integration tests in `tests/integration/voice-agent-backend-routes.test.ts`; mounted routes return defined 501 + route name; placeholder behavior sufficient for Phase 2.

**Phase 1 done:** Contract tests in `tests/voice-agent-backend-api.test.ts`; package at `packages/voice-agent-backend` with `createServer` and `mountVoiceAgentBackend`; placeholder routes (501); package README added.

---

## References

- [README.md](./README.md) — Issue scope and summary.
- `test-app/scripts/backend-server.js` — Current backend server.
- `scripts/openai-proxy/` — Current OpenAI proxy (server, CLI).
- Issue #407 — Backend function-call contract.
- Issue #414 — Component/proxy interface (protocol, transcript, VAD).
