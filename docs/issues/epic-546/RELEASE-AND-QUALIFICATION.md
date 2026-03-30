# Release and qualification — EPIC-546

Use this checklist when shipping `@signal-meaning/voice-agent-backend` changes for the OpenAI proxy (packaging + TLS contract).

**Full release process (branch, docs, GitHub Release, CI publish, dist-tags, merge to `main`):** GitHub [#554](https://github.com/Signal-Meaning/dg_react_agent/issues/554) — see [ISSUE-554/](./ISSUE-554/README.md).

**Live pre-release progress table** (commands, PASS/FAIL, notes): [ISSUE-554/TRACKING.md](./ISSUE-554/TRACKING.md).

---

## Versioning

- [x] **Patch** (e.g. `0.2.11`) for packaging-only fix ([#547](https://github.com/Signal-Meaning/dg_react_agent/issues/547)) if behavior is unchanged except dependency graph / crash fix. — **Selected** for #554 / EPIC-546: **voice-agent-backend 0.2.11**, root **voice-agent-react 0.10.6** on **`release/v0.10.6`**.
- [ ] **Minor** (e.g. `0.3.0`) if env contract is **breaking** (e.g. removing `HTTPS` as trigger without compatibility shim) — follow semver and changelog. — **Not** this release.

---

## Pre-publish checks (monorepo)

### Jest (root)

- [x] `npm test` (root) passes, or **`CI=true RUN_REAL_API_TESTS=false npm run test:mock`** for parity with the **Test and Publish** workflow Jest step. — **PASS** **2026-03-29** (122 suites / 1166 tests passed; see [ISSUE-554/TRACKING.md](./ISSUE-554/TRACKING.md)).
- [x] `npm test -- tests/integration/openai-proxy-integration.test.ts` passes (mock upstream). — **PASS** (batched **2026-03-29** with other Jest targets).
- [x] `npm test -- tests/integration/openai-proxy-run-ts-entrypoint.test.ts` passes — **same entrypoint as test-app** (`npx tsx scripts/openai-proxy/run.ts` from `packages/voice-agent-backend`, mock upstream via `OPENAI_REALTIME_URL`). — **PASS** **2026-03-29**.
- [x] `npm test -- tests/openai-proxy-event-coverage.test.ts` passes (event mapping guard). — **PASS** **2026-03-29**.
- [x] **`tests/lazy-initialization.test.js`** passes (Issue #206 — lazy WebSocket managers; **not** covered by removed Playwright `lazy-initialization-e2e`). — **PASS** **2026-03-29**.

### Real OpenAI (when `OPENAI_API_KEY` is available)

- [x] If this release changes proxy↔API ordering, timing, or translator behavior: **`USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`** (per `.cursorrules` release qualification). Log outcome in [ISSUE-554/TRACKING.md](./ISSUE-554/TRACKING.md) or release notes. — **PASS** **2026-03-28** (20 passed, 0 failed); logged in TRACKING.

### Lint, audit, optional Deepgram

- [x] `npm run lint` (root) passes (or note warnings if policy allows). — **PASS** **2026-03-29** (**0 errors**, **4** `no-console` warnings in `src/test-utils/test-helpers.ts`).
- [x] `npm audit --audit-level=high` passes at root (or document exceptions). — **PASS** **2026-03-29** (0 vulnerabilities).
- [x] Live Deepgram Voice Agent auth is **opt-in**: `tests/integration/websocket-connectivity.test.js` runs only with **`RUN_DEEPGRAM_CONNECTIVITY_TESTS=1`** — see GitHub [#556](https://github.com/Signal-Meaning/dg_react_agent/issues/556); **not** required for OpenAI proxy / packaging qualification. — **N/A** for #554 qualification (documented under #556).

### E2E (test-app, CI subset)

From **`test-app`** (see `npm run test:e2e:ci` in `test-app/package.json`):

- [x] **`npm run test:e2e:ci`** — runs **`api-key-validation.spec.js`**, **`page-content.spec.js`**, **`deepgram-ux-protocol.spec.js`**, **`protocol-validation-modes.spec.js`** with proxy mode + `E2E_USE_HTTP=1` (Playwright starts dev + backend unless you use `E2E_USE_EXISTING_SERVER=1` per [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md)). — **PASS** **2026-03-29** (**9 passed**, **3 skipped** — **deepgram-ux-protocol** suite skipped, [#556](https://github.com/Signal-Meaning/dg_react_agent/issues/556)).

**Known skips / debt:**

- **`deepgram-ux-protocol.spec.js`:** entire describe is **`test.describe.skip`** pending [#556](https://github.com/Signal-Meaning/dg_react_agent/issues/556) — listed in [`docs/issues/ISSUE-556/E2E-SKIPS.md`](../ISSUE-556/E2E-SKIPS.md). Treat as tracked exception for #554 pre-release or re-enable when fixed.
- **Lazy initialization** is **not** in this E2E list; use root **`tests/lazy-initialization.test.js`** instead.

Broader regression: **`npm run test:e2e`** (full Playwright suite from `test-app`) when you need coverage beyond the CI subset.

### Build / publish hooks

- [ ] Lint / build per release checklist if this repo ties them to publish.

---

## Packaging smoke (consumer simulation)

**Goal:** Prove a clean **production** install loads the proxy without `MODULE_NOT_FOUND`.

- [ ] From `packages/voice-agent-backend`: `npm pack` (or root script if defined).
- [ ] Install tarball in an **empty** temp project: `npm install ./signal-meaning-voice-agent-backend-*.tgz` (exact filename from pack).
- [ ] Do **not** install devDependencies of the tarball as if you were the package author; the temp project should only have the tarball as dependency.
- [ ] Run the proxy entry with `OPENAI_API_KEY` set and env combinations documented for the release (HTTP default; PEM mode; explicit dev TLS if shipped).
- [ ] Confirm process starts and listens (or fails only on expected validation such as missing key), **not** on missing modules.

Record command, date, and outcome in the relevant [TRACKING-547.md](./TRACKING-547.md) / [TRACKING-548.md](./TRACKING-548.md).

---

## Publish

- [ ] Follow [docs/PUBLISHING-AND-RELEASING.md](../../../PUBLISHING-AND-RELEASING.md) for GitHub Packages.
- [ ] Changelog / release notes mention: packaging fix, any env renames, migration from `HTTPS` for proxy.

---

## Post-publish

- [ ] Notify integrators (e.g. Voice Commerce) with version to adopt and removal of `selfsigned` workaround if applicable.
- [ ] Close or update GitHub issues #547–#552 and epic #546 per actual shipped scope.
