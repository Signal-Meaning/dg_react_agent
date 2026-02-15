# Issue #445: TDD plan — Move OpenAI proxy out of voice-agent-react

**Parent:** [README.md](./README.md) · **GitHub:** [#445](https://github.com/Signal-Meaning/dg_react_agent/issues/445)

---

## Overview

This document is the **Test-Driven Development** plan for fixing the packaging defect: the OpenAI translation proxy must live in a backend-facing package so backends never need to resolve the React package. All work follows the project rule: **tests first (RED), then minimal implementation (GREEN), then refactor (REFACTOR).**

**Goal:**

- Backends can run the OpenAI proxy using only `@signal-meaning/voice-agent-backend` (or a dedicated proxy package)—no `require.resolve('@signal-meaning/voice-agent-react/...')`.
- The React package does not ship or document the proxy as the canonical way for backends to run it.
- test-app and E2E run the proxy from the backend (or proxy) package path.

**Why TDD for packaging:** Packaging mistakes are easy to reintroduce (e.g. re-adding `scripts` to the React package, or spawning the proxy from the wrong path). Tests that encode the *contract*—what each package must and must not ship, and that backends can run the proxy from the backend package only—give us executable specifications. We write those tests first (RED), then implement the move and file changes (GREEN), then refactor. The tests then live on in CI and protect the allocation. The same tests are the backbone of our ongoing validation (see [VALIDATION.md](./VALIDATION.md)); the rules they enforce are documented in [docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md).

---

## Current state (baseline)

- **OpenAI proxy:** Lives at root `scripts/openai-proxy/` (run.ts, server, translator, CLI, etc.). Shipped in the React package because root `package.json` `files` includes `scripts`.
- **Backends (e.g. voice-commerce):** Resolve `require.resolve('@signal-meaning/voice-agent-react/package.json')` to get a cwd and spawn `npx tsx scripts/openai-proxy/run.ts`. They must depend on the React package only to run the proxy.
- **test-app backend:** Uses `cwd: path.resolve(__dirname, '..', '..')` (repo root) and `args: ['tsx', 'scripts/openai-proxy/run.ts']`; works in-repo but encodes the assumption that the proxy lives at repo root under the React package.
- **Existing tests:** `tests/integration/openai-proxy-integration.test.ts`, `tests/integration/openai-proxy-cli.test.ts` import from `../../scripts/openai-proxy/` and run with cwd repo root. No test today asserts “proxy is runnable from backend package” or “React package does not ship proxy.”

---

## Phase 1: Packaging contract tests (RED)

**Goal:** Tests define the desired packaging contract before any move. They must **fail** while the proxy still lives in the React package and backends still resolve the React package.

### 1.1 RED — Backend can run proxy from backend package only

**Location:** e.g. `tests/packaging/openai-proxy-from-backend-package.test.ts` or `tests/integration/openai-proxy-packaging.test.ts`.

1. **Write failing tests** that:
   - Resolve the **backend** package (e.g. `path.dirname(require.resolve('@signal-meaning/voice-agent-backend/package.json'))` when run from repo, or equivalent for published package).
   - Assert that the proxy **entry script** (e.g. `run.ts` or a bin) exists at a deterministic path **under the backend package** (e.g. `<backend-pkg>/scripts/openai-proxy/run.ts` or `<backend-pkg>/openai-proxy/run.ts`).
   - Optionally: spawn the proxy with that path as cwd (or run the script via `npx tsx <path>`), wait for server to listen, then assert a client can connect to the proxy WebSocket path and receive a defined response (e.g. connection accepted or first message). This proves “backends can run the proxy without the React package.”
2. Run tests → **RED** (proxy does not exist under backend package yet; or resolve of backend package does not expose the script path).

### 1.2 RED — React package does not ship the OpenAI proxy

**Location:** e.g. `tests/packaging/react-package-files.test.ts` or `tests/integration/react-package-no-proxy.test.ts`.

1. **Write failing tests** that:
   - Run `npm pack --dry-run` (or `npm pack` and inspect the tarball) for the **root** package (voice-agent-react).
   - Assert that the packed file list does **not** include any path under `scripts/openai-proxy/` (e.g. no `package/scripts/openai-proxy/run.ts`). Alternatively: assert that the `files` in package.json do not include `scripts` (or that a whitelist of allowed scripts does not include openai-proxy).
2. Run tests → **RED** (today the React package’s `files` includes `scripts`, so the tarball does include openai-proxy).

### 1.3 RED — test-app backend spawns proxy from backend package path

**Location:** e.g. `tests/integration/test-app-backend-proxy-spawn.test.ts` or an E2E step in `test-app/tests/e2e/`.

1. **Write failing tests** that:
   - Start the test-app backend (or a minimal server that uses the same spawn logic) with OpenAI proxy enabled.
   - Assert that the **spawn** call (or the options passed to `attachVoiceAgentUpgrade`) uses a **cwd** (or script path) derived from the **backend** package resolution, not from the React package. For example: mock or capture the spawn arguments and assert `cwd` is the backend package directory (or a subdirectory of it), or that the script path contains the backend package path and does not contain `voice-agent-react`.
2. Run tests → **RED** (test-app backend still uses repo root / React package for cwd).

**Deliverables (Phase 1):** Three test groups written and failing, defining “proxy in backend package,” “React package doesn’t ship proxy,” and “test-app uses backend package for proxy.”

---

## Phase 2: Move proxy into voice-agent-backend (GREEN)

**Goal:** Implement the move so Phase 1 tests pass. Prefer moving into `voice-agent-backend`; if the decision is a dedicated package, adjust paths accordingly.

### 2.1 GREEN — Proxy code and entry under backend package

1. Relocate `scripts/openai-proxy/` to `packages/voice-agent-backend/` (e.g. `packages/voice-agent-backend/scripts/openai-proxy/` or `packages/voice-agent-backend/openai-proxy/`). Preserve all existing files (run.ts, server.ts, translator.ts, logger.ts, cli.ts, etc.).
2. Update `packages/voice-agent-backend/package.json`:
   - Add the proxy directory to `files` so the package publishes it (e.g. `"files": ["src", "scripts", "README.md"]` or `"openai-proxy"`).
   - Optionally add a `bin` or script that runs the proxy (e.g. `openai-proxy: "node scripts/openai-proxy/run.js"` after compiling, or document `npx tsx scripts/openai-proxy/run.ts` with cwd = package dir).
3. Fix any import paths inside the moved proxy (relative paths, env loading from package dir vs repo root).
4. Run Phase 1.1 tests → **GREEN** (proxy exists under backend package; resolve backend package and run from there).

### 2.2 GREEN — Backend README and API

1. Document in `packages/voice-agent-backend/README.md` how to run the OpenAI proxy from the package (e.g. resolve `@signal-meaning/voice-agent-backend/package.json`, set cwd to package dir, run `npx tsx scripts/openai-proxy/run.ts`). Update `attachVoiceAgentUpgrade` options if the package exposes a default `openai.spawn.cwd` or script path.
2. Optionally: export a helper (e.g. `getOpenAIProxyScriptDir()`) that returns the path to the proxy script directory so consumers don’t have to construct it from `require.resolve`.
3. Run Phase 1.1 (and any integration spawn test) → **GREEN**.

### 2.3 REFACTOR

- Ensure backend package has any devDependencies needed to run the proxy (e.g. `tsx`, `dotenv`) or document that consumers run with `npx tsx` from the package.
- Align run.ts .env loading with package root (e.g. load from `process.cwd()` when cwd is the backend package dir).

**Deliverables (Phase 2):** Proxy lives under voice-agent-backend; Phase 1.1 tests pass; backend README documents “run proxy from this package.”

---

## Phase 3: test-app and E2E use backend package for proxy (GREEN)

**Goal:** test-app backend (and E2E) spawn the proxy from the backend package path only.

### 3.1 GREEN — test-app backend spawn options

1. In `test-app/scripts/backend-server.js` (and any other caller that spawns the OpenAI proxy):
   - Replace cwd from repo root with cwd (or script path) from resolving the **backend** package. Example: `const backendPkgDir = path.dirname(require.resolve('@signal-meaning/voice-agent-backend/package.json'));` then `cwd: backendPkgDir`, `args: ['tsx', 'scripts/openai-proxy/run.ts']` (or the chosen path under the backend package).
   - Ensure the backend package is resolvable from test-app (e.g. workspace or dependency).
2. Run Phase 1.3 tests → **GREEN** (spawn uses backend package path).

### 3.2 GREEN — Existing openai-proxy integration and E2E

1. Update `tests/integration/openai-proxy-integration.test.ts` and `tests/integration/openai-proxy-cli.test.ts` so they resolve and run the proxy from the **backend** package path (not from repo root `scripts/openai-proxy`). Tests may still run from repo root but cwd/path for the proxy process must be the backend package.
2. Run existing openai-proxy integration and CLI tests → **GREEN**.
3. Run E2E that use the OpenAI proxy (e.g. `openai-proxy-e2e`) → **GREEN** (test-app backend already fixed in 3.1).

### 3.3 REFACTOR

- Remove any remaining references to “run from repo root” in comments or docs for the proxy when used by test-app.
- Ensure root `package.json` script `openai-proxy:cli` (if kept) documents that it should be run with backend package cwd when outside repo, or point to backend package in docs.

**Deliverables (Phase 3):** test-app and integration/E2E run proxy from backend package; Phase 1.3 and related tests pass.

---

## Phase 4: React package must not ship proxy (GREEN)

**Goal:** React package’s published tarball does not include the OpenAI proxy (and ideally no backend-only scripts).

### 4.1 GREEN — Remove or narrow `files` in root package.json

1. Remove `scripts` from the root (voice-agent-react) `package.json` `files` array. If we must keep some scripts for backward compatibility (not recommended), at minimum exclude `scripts/openai-proxy` via a more precise `files` list (e.g. list only `dist`, `src`, `README.md`, etc., and omit `scripts`).
2. Run Phase 1.2 tests → **GREEN** (npm pack no longer includes openai-proxy).

### 4.2 REFACTOR

- Review other entries in `files` (e.g. `test-app`, `tests`, `docs`) per product decision; document in README or release notes that the React package no longer ships the OpenAI proxy and that backends should use `@signal-meaning/voice-agent-backend` (or the dedicated proxy package) to run it.

**Deliverables (Phase 4):** React package does not ship proxy; Phase 1.2 tests pass.

---

## Phase 5: Documentation and acceptance

**Goal:** Docs and acceptance criteria fully aligned with the new allocation.

### 5.1 GREEN — Docs updated

1. Update `docs/OPENAI-WEBSOCKET-CONNECTION-FAILURE.md` (or equivalent): remove or rewrite any section that says “resolve voice-agent-react to run the proxy”; replace with “resolve voice-agent-backend and run the proxy from that package.”
2. Update any other “run the OpenAI proxy” instructions in the repo to use the backend package path only.
3. Optional: add a short “Packaging” or “Script allocation” note in `docs/` or README referring to ISSUE-445 so future changes keep backend vs frontend script ownership clear.

### 5.2 Acceptance criteria (final check)

- [ ] Backends can run the OpenAI translation proxy using only `@signal-meaning/voice-agent-backend` (or dedicated proxy package)—no `require.resolve('@signal-meaning/voice-agent-react/...')`.
- [ ] voice-agent-react package does not ship or document the proxy as the canonical way to run it for backends.
- [ ] test-app and E2E run the proxy from the backend (or proxy) package; no reliance on React package for proxy path.
- [ ] Documentation reflects the new allocation and best practices.

### 5.3 Policy and validation (ongoing)

1. Ensure [docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md) and [VALIDATION.md](./VALIDATION.md) reflect the outcome: React package must not ship proxy or scripts; backend package ships proxy; packaging tests live in `tests/packaging/` and run in CI.
2. Add packaging tests to the normal test run (and CI) so any future change to `files` or script locations is validated automatically.

**Deliverables (Phase 5):** All acceptance criteria verified; docs updated; policy and validation aligned and running in CI.

---

## Phase summary

| Phase | Focus | Key tests (RED first) | Deliverable |
|-------|--------|------------------------|-------------|
| 1 | Packaging contract | 1.1 Proxy runnable from backend package; 1.2 React pack doesn’t ship proxy; 1.3 test-app spawn from backend package | Failing tests define contract |
| 2 | Move proxy to backend | Same tests → GREEN | Proxy under voice-agent-backend; 1.1 GREEN |
| 3 | test-app / E2E | Spawn and integration use backend package path | 1.3 GREEN; openai-proxy integration/E2E GREEN |
| 4 | React package files | npm pack excludes proxy | 1.2 GREEN |
| 5 | Docs and acceptance | Manual / checklist | Docs updated; acceptance criteria met |

---

## TDD rules (reminder)

- **RED:** Write failing tests that define the desired behavior before implementation.
- **GREEN:** Implement the minimum necessary to make those tests pass.
- **REFACTOR:** Improve structure and docs while keeping tests green.
- **No implementation** of package move or file layout changes without tests first (Phases 1.1–1.3).

---

## Dependencies and order

- **Phase 1** must be done first (all RED tests written and failing).
- **Phase 2** implements the move so 1.1 (and spawn behavior) passes; 1.2 and 1.3 may still be RED.
- **Phase 3** updates test-app and integration/E2E so 1.3 and existing proxy tests pass.
- **Phase 4** updates React package `files` so 1.2 passes.
- **Phase 5** can run in parallel with 3/4 or after; no test dependency.

---

## Progress tracking

Update as phases are completed.

| Phase | RED | GREEN | REFACTOR |
|-------|-----|-------|----------|
| 1. Packaging contract tests | _Pending_ | — | — |
| 2. Move proxy to backend | — | _Pending_ | _Pending_ |
| 3. test-app / E2E use backend package | — | _Pending_ | _Pending_ |
| 4. React package files | — | _Pending_ | _Pending_ |
| 5. Docs and acceptance | — | _Pending_ | — |

---

## References

- [README.md](./README.md) — Issue scope, bug report, approach, script allocation.
- [VALIDATION.md](./VALIDATION.md) — How we validate packaging; packaging contract tests; extending to other decisions.
- [docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md) — Single source of truth for testable packaging rules.
- `scripts/openai-proxy/` — Current proxy location (to move).
- `packages/voice-agent-backend/` — Target package (or dedicated proxy package).
- `test-app/scripts/backend-server.js` — test-app spawn logic to update.
- Issue #423 — voice-agent-backend package and attachVoiceAgentUpgrade.
