# Issue #445: Packaging — Move OpenAI translation proxy out of voice-agent-react

**GitHub:** [#445](https://github.com/Signal-Meaning/dg_react_agent/issues/445)  
**Branch:** _(TBD)_  
**Status:** Open

---

## Tracking

| Item | Status |
|------|--------|
| Decision: proxy in voice-agent-backend vs dedicated package | _Pending_ |
| Move proxy code to chosen package | _Pending_ |
| Update voice-agent-react `files` (stop publishing proxy) | _Pending_ |
| test-app / E2E run proxy from backend (or proxy) package | _Pending_ |
| Docs updated (backend README, OPENAI-WEBSOCKET-CONNECTION-FAILURE.md) | _Pending_ |
| Packaging policy and validation: tests in CI; PACKAGING-POLICY / VALIDATION aligned | _Pending_ |
| Acceptance criteria verified | _Pending_ |

**TDD plan:** All implementation follows tests first. See **[TDD-PLAN.md](./TDD-PLAN.md)** for RED → GREEN → REFACTOR phases (packaging contract tests, move proxy to backend, test-app/E2E, React package files, docs).

**Validating packaging decisions:** To ensure our allocation decisions (and future ones) stay correct, we use a **packaging policy** and **contract tests**. See **[VALIDATION.md](./VALIDATION.md)** for how we validate (tests, CI, pre-publish) and **[docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md)** for the single source of truth (what each package must / must not ship; how to extend validation to other scripts).

---

## Approach (how we're addressing this)

1. **Fix the defect** — Move the OpenAI proxy into a backend-facing package so backends never need to resolve the React package; update React package `files` so it no longer ships the proxy.

2. **Allocation audit** — We documented every script and artifact by purpose and consumer (see "Script and artifact allocation" below). That audit is the source of truth for *what belongs where*: backend-runnable vs test-infra vs publish/release vs test-app-only. It prevents the same class of mistake (putting backend or maintainer-only code in the React package) and guides future moves.

3. **Policy as single source of truth** — [docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md) turns the principles and allocation into **testable rules** (what each package must / must not ship). The policy is the executable spec; the allocation tables in this README are the full audit. When we add or move scripts, we update both and run packaging tests.

4. **Validation via tests and CI** — Packaging contract tests ([VALIDATION.md](./VALIDATION.md)) assert that each package's published contents match the policy (e.g. React package does not ship proxy or scripts; backend package ships proxy after move). We run these tests in CI and before publish so regressions are caught automatically.

5. **TDD** — We write the packaging contract tests **first** (RED), then implement the move and file changes (GREEN), then refactor and update docs (REFACTOR). See [TDD-PLAN.md](./TDD-PLAN.md). No change to package layout or `files` without a test that defines the desired outcome.

**Docs in this directory:**

| Doc | Purpose |
|-----|--------|
| [README.md](./README.md) | This file — issue summary, bug report, approach, allocation, acceptance criteria. |
| [TDD-PLAN.md](./TDD-PLAN.md) | RED → GREEN → REFACTOR phases; packaging contract tests first, then move proxy, test-app, React files, docs. |
| [VALIDATION.md](./VALIDATION.md) | How we validate packaging (tests, CI, pre-publish); how to extend to other decisions. |

Policy (repo-wide): [docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md).

---

## Bug Report: Translation proxy script lives in React package — packaging / architecture

**Audience:** dg_react_agent team (`@signal-meaning/voice-agent-react`, `@signal-meaning/voice-agent-backend`)  
**Date:** 2026-02-15  
**From:** Voice-commerce host app (Issue #901)  
**Type:** Packaging / architecture request (not a runtime bug)

---

### Summary

The **OpenAI translation proxy** (the script that translates between the component's protocol and the OpenAI Realtime API) currently lives inside the **voice-agent-react** package at `scripts/openai-proxy/run.ts`. Backends that use `voice-agent-backend` and want to run the translation proxy must therefore **resolve the React package** (e.g. `require.resolve('@signal-meaning/voice-agent-react/package.json')`) only to get the script's directory so they can spawn `npx tsx scripts/openai-proxy/run.ts`. That forces a backend-only process to depend on the location of a React UI package. We would not architect it that way: the proxy is a backend concern and should be packaged so backends don't need to touch the React package.

---

### Why this is a packaging error

- The **translation proxy** is a **backend** component: it runs as a subprocess, speaks WebSocket to the client (component protocol) and to OpenAI (Realtime API). It has no React dependency.
- **voice-agent-react** is a **frontend** package: React components and browser-side behavior.
- Putting the proxy script inside the React package:
  - Forces backends to depend on (or resolve) a React package they don't otherwise use.
  - Couples backend-only tooling to frontend package layout and install (e.g. hoisting, workspace structure).
  - Makes it harder for backends to run the proxy without pulling in the whole React package.

A cleaner architecture would ship the translation proxy in a package that backends already depend on (e.g. **voice-agent-backend**) or in a small dedicated package (e.g. **openai-translation-proxy**), so that:

- Backends install one backend-facing package and run the proxy from there (no `require.resolve` of the React package).
- The React package stays a frontend concern; the proxy stays a server-side concern.

---

### Current workaround in voice-commerce

We call `require.resolve('@signal-meaning/voice-agent-react/package.json')` to get the package directory and spawn the proxy with that as `cwd`. We list `@signal-meaning/voice-agent-react` in the backend's `package.json` only so that resolve can find the script. We do not use the React component in the backend. If the package isn't installed in the backend's node_modules (e.g. hoisting), the resolve can fail and we disable the OpenAI proxy. This is a direct result of the proxy living in the React package.

---

### Request (immediate fix)

- **Preferred:** Ship the translation proxy (e.g. `scripts/openai-proxy/` or equivalent) in **voice-agent-backend** (or another backend-only package) so that backends can run it via a path/resolve from a package they already depend on.
- **Alternative:** Publish a small, separate package (e.g. `@signal-meaning/openai-translation-proxy`) that contains only the proxy script, and have both voice-agent-react (for test-app or dev) and voice-agent-backend (or docs) reference that package for running the proxy.

Either way, backends should not need to `require.resolve('@signal-meaning/voice-agent-react/...')` to run the proxy.

---

## Broader proposal: Package and script allocation audit

To prevent similar packaging mistakes and align with common practice for multi-package repos, we should adopt clear rules and do a one-time allocation audit.

### Principles

1. **Frontend-only in the React package**  
   `@signal-meaning/voice-agent-react` should ship only what React apps need: component code, types, and any browser-side utilities. No server-side or proxy scripts.

2. **Backend tooling in backend (or dedicated) packages**  
   Scripts that run in Node (proxies, CLIs, server helpers) belong in a package that backends install: either `voice-agent-backend` or a small dedicated package. Consumers should never need to resolve the React package to run backend tooling.

3. **What belongs at repo root vs in packages**  
   Scripts that only maintainers or CI run (build, publish, release, test orchestration, test-infra) stay at repo root and must **not** be part of the React package's published `files`. The React package should not ship backend-runnable scripts (e.g. the OpenAI proxy) or unnecessary tooling; we can narrow `files` so the tarball contains only what React app consumers need (or remove `scripts` from the React package once the proxy is moved).

### Script and artifact allocation (current state)

Grouped by **purpose** and **consumer**. This is the full picture so we can decide what to move and what to keep where.

#### Backend-runnable (consumed by backends or test-app backend)

| Location | Contents | Consumer | Note |
|----------|----------|----------|------|
| Root `scripts/openai-proxy/` | OpenAI Realtime translation proxy: `run.ts`, server, translator, CLI, logger, audio constants | Backends (spawn via voice-agent-backend), test-app backend, E2E | **Should move** to voice-agent-backend (or dedicated package) so backends do not resolve the React package. |
| `packages/voice-agent-backend` | **Deepgram proxy**: in-process WebSocket proxy in `attach-upgrade.js` (no standalone script). Also Express mount, OpenAI spawn wiring, function-call. | Backends, test-app | Deepgram has no separate script; it's library code in the backend package. |

#### Test infra (support frontend/E2E and Jest tests)

| Location | Contents | Consumer | Note |
|----------|----------|----------|------|
| Root `scripts/generate-test-audio.js` | Generates TTS audio samples via Deepgram TTS REST API for test fixtures | E2E tests, Jest tests that use audio fixtures; `tests/utils/audio-simulator.js` and test-app equivalent | Critical for E2E/frontend testing. Run via `npm run generate-test-audio`. Should **not** be in React package tarball (maintainer/CI only). |
| Root `scripts/extend-audio-silence.js` | Extends silence in existing audio samples (e.g. for UtteranceEnd detection tests) | Maintainers when preparing or adjusting fixtures | Test infra; not for npm consumers. |

#### React package / build support (run from root, support the component)

| Location | Contents | Consumer | Note |
|----------|----------|----------|------|
| Root `scripts/validate-plugin.js` | Validates package.json and plugin integration requirements (peer deps, etc.) before build | Pre-build (currently skipped in prebuild); maintainers | Should not be in React package tarball. |
| Root `scripts/generate-single-file.js` | Bundles the React component into a single file for copy-paste usage | Maintainers / docs | Not for publish; dev convenience. |

#### Publish and release (maintainers / CI only)

| Location | Contents | Consumer | Note |
|----------|----------|----------|------|
| Root `scripts/validate-publish-auth.js` | Validates publish workflow auth (simulates CI steps) | Maintainers before release | |
| Root `scripts/validate-packages-published.sh` | Validates both @signal-meaning packages exist on GitHub Packages (gh api) | Maintainers | |
| Root `scripts/validate-release-docs.js` | Validates release docs present for version | Maintainers; `validate:release-docs` | |
| Root `scripts/test-npm-token.js`, `test-npm-token-isolated.js`, `test-npm-token-env.sh` | Test NPM token / registry auth | Maintainers | |
| Root `scripts/check-token-issues.js`, `test-local-auth.js`, `debug-npm-auth.js`, `simulate-github-action.sh` | Debug and simulate auth/CI | Maintainers | |
| Root `scripts/create-release-issue.sh` | Create GitHub release issue and working branch | Maintainers; `release:issue` | |

#### Test execution and dev workflow (maintainers / CI)

| Location | Contents | Consumer | Note |
|----------|----------|----------|------|
| Root `scripts/comprehensive-test-run.sh` | Runs all test types in stages, generates report; checks API config (Jest/E2E) | Maintainers / CI | |
| Root `scripts/monitor-e2e-tests.sh` | Monitor E2E test progress (tail log) | Maintainers | |
| Root `scripts/run-test-with-log.sh` | Run a single Jest test with output captured to log | Maintainers | |
| Root `scripts/dev-workflow.sh` | Dev workflow: build, test, package, clean, status | Maintainers; `workflow`, `status` | |
| Root `scripts/package-for-local.sh` | Create .tgz for local install | Maintainers; `package:local` | |

#### test-app only (not published with any package)

| Location | Contents | Consumer | Note |
|----------|----------|----------|------|
| `test-app/scripts/backend-server.js` | Single HTTP(S) server: Deepgram proxy attach, OpenAI proxy spawn, function-call | test-app when running `npm run backend` | Uses voice-agent-backend and spawns root `scripts/openai-proxy/run.ts` (cwd repo root). After fix: should spawn proxy from backend package path. |
| `test-app/scripts/function-call-handlers.js` | Function-call handlers (e.g. get_current_time) for test-app | test-app backend | |
| `test-app/scripts/logger.js` | Shared logger for test-app scripts (Issue #412) | test-app scripts | |

#### React package publish (`package.json` `files`)

| Artifact | In `files` today? | Note |
|----------|-------------------|------|
| `dist`, `src`, `tests`, `README.md`, `DEVELOPMENT.md`, `docs`, **`scripts`**, **`test-app`** | Yes | Including `scripts` ships the entire OpenAI proxy and all root scripts in the React tarball. That is what we are fixing: backends must not need the React package to run the proxy. At minimum, proxy should move out; then remove `scripts` (or narrow sharply) so npm consumers don't get publish/test-infra scripts. |

### Recommended allocation

1. **Move OpenAI proxy into `voice-agent-backend`**  
   - Relocate `scripts/openai-proxy/` (or equivalent) into `packages/voice-agent-backend` (e.g. `packages/voice-agent-backend/scripts/openai-proxy/` or `packages/voice-agent-backend/openai-proxy/`).
   - Publish these files with the backend package (update `packages/voice-agent-backend/package.json` `files`).
   - Backend API: document that the default/recommended way to run the OpenAI proxy is from the backend package (e.g. `require.resolve('@signal-meaning/voice-agent-backend/package.json')` → path to script, or a bin/CLI that runs the proxy).
   - Update voice-commerce (and any other consumers) to resolve the backend package for proxy `cwd`/path, not the React package.
   - **Alternative (if we prefer a separate package):** Create `packages/openai-translation-proxy` (or scoped name `@signal-meaning/openai-translation-proxy`), move the proxy there, publish it, and have voice-agent-backend (and docs) reference it. Backends would depend only on the backend package and/or the proxy package, not the React package.

2. **React package: stop publishing backend scripts**  
   - Remove `scripts` (and if not needed for published examples, `test-app`) from the React package's `files` array so the React tarball doesn't ship the proxy. If test-app is kept for "reference" in the package, that can be a separate decision; at minimum, the proxy should not live in the React package.

3. **Repo root**  
   - Keep test-infra (generate-test-audio, extend-audio-silence), build support (validate-plugin, generate-single-file), publish/release, and test-execution/dev-workflow scripts at root. They are for maintainers/CI only and must not be in the React package's published `files`. For local E2E, root (or test-app) runs the proxy by resolving the backend package (or the new proxy package), not `scripts/openai-proxy` at root.

4. **test-app and E2E**  
   - test-app backend and E2E should run the proxy from the backend package (or new proxy package) path—e.g. resolve backend package and run `npx tsx <backend-pkg>/scripts/openai-proxy/run.ts` (or equivalent). No dependency on the React package for proxy path.

5. **Docs and README**  
   - Update backend README, OPENAI-WEBSOCKET-CONNECTION-FAILURE.md, and any "run the proxy" instructions to use the backend (or proxy) package path only. Remove any instructions that tell backends to resolve or depend on the React package to run the proxy.

### Acceptance criteria (for this issue)

- [ ] Backends can run the OpenAI translation proxy using only `@signal-meaning/voice-agent-backend` (or a dedicated proxy package)—no `require.resolve('@signal-meaning/voice-agent-react/...')`.
- [ ] voice-agent-react package does not ship or document the proxy as the canonical way to run it for backends.
- [ ] test-app and E2E run the proxy from the backend (or proxy) package; no reliance on React package for proxy path.
- [ ] Documentation (backend README, OPENAI-WEBSOCKET-CONNECTION-FAILURE.md, etc.) reflects the new allocation and best practices.

---

## References

- Voice-commerce backend: `backend/src/index.js` — `buildOpenAIOptions()`, spawn cwd from `require.resolve('@signal-meaning/voice-agent-react/package.json')`.
- Doc: OPENAI-WEBSOCKET-CONNECTION-FAILURE.md (§ "Why is OpenAI disabled? Why do we resolve voice-agent-react?").
- This repo: `scripts/openai-proxy/`, `packages/voice-agent-backend/`, root `package.json` `files`, `test-app/scripts/backend-server.js`.
- **Packaging policy and validation:** [docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md), [VALIDATION.md](./VALIDATION.md), [TDD-PLAN.md](./TDD-PLAN.md).
