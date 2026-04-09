# Issue #570: Release checklist — v0.11.0 (minor)

**GitHub:** [#570](https://github.com/Signal-Meaning/dg_react_agent/issues/570)

**Scope:** **Minor** release after **`v0.10.6`**: proxy/audio/test-app work on `main` (Issues **#559–#565**, **#561**; epic **#546** rollup). See [RELEASE-CONTEXT.md](./RELEASE-CONTEXT.md).

**Authoritative checklist:** Checkboxes on **GitHub Issue #570** mirror [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md). This file is the **repo-local** companion: fixed versions, paths, and focused commands (same pattern as [ISSUE-544/RELEASE-CHECKLIST.md](../ISSUE-544/RELEASE-CHECKLIST.md)).

---

## Release v0.11.0 (component + backend **0.2.12**)

### Overview

**Release type:** **Minor** (new backward-compatible behavior + fixes; confirm no unintended breaking changes in `API-REFERENCE.md` / `MIGRATION.md` if needed).

**Packages:** Bump and publish **both** unless you explicitly ship one package only (document in [TRACKING.md](./TRACKING.md) and on Issue #570).

| Package | Location | Version for this release |
|---------|----------|--------------------------|
| **@signal-meaning/voice-agent-react** | Root `package.json` | **0.11.0** (tag **v0.11.0**) |
| **@signal-meaning/voice-agent-backend** | `packages/voice-agent-backend/package.json` | **0.2.12** |

**Minor documentation set:** Per template, create **`docs/releases/v0.11.0/`** with `CHANGELOG.md`, `PACKAGE-STRUCTURE.md`, plus **NEW-FEATURES.md**, **API-CHANGES.md**, **EXAMPLES.md**; add **MIGRATION.md** only if breaking changes exist.

### Progress

- **Pre-publish (in progress):** Full Jest (`npm test`), upstream event coverage, and **real-API** `openai-proxy-integration` (20 ran, 70 skipped) passed **2026-04-09**; first full real-API run hit transient upstream **504** on one test — immediate retry + full re-run green. `npm run clean && npm run build && npm run validate` passed; **`issue-570`** and **`release/v0.11.0`** pushed to `origin`.
- **E2E (2026-04-09, user-hosted backend + Vite):**
  - **Full suite from repo root:** `USE_PROXY_MODE=true npm run test:e2e` → **110 passed, 93 failed, 46 skipped** (~12.5m). Most failures are **Deepgram-direct** specs (`deepgram-*.spec.js`, VAD, idle-timeout against real Deepgram) and collateral flakes (`Target page, context or browser has been closed`) when upstream or connection setup does not match spec expectations. **Not all-green** without a valid **`VITE_DEEPGRAM_API_KEY`** (and stable Deepgram) for those paths — see [E2E-BACKEND-MATRIX.md](../../../test-app/tests/e2e/E2E-BACKEND-MATRIX.md).
  - **OpenAI proxy slice (recommended for this release):** from **`test-app`**, with backend + dev server already running:  
    `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true E2E_USE_HTTP=1 USE_REAL_APIS=1 npm run test:e2e:openai`  
    → **25 passed, 3 failed, 2 skipped** (~5m). **Failed:** `callback-test.spec.js` (×2 — page closed during mic reconnect helper after connection), `openai-proxy-e2e.spec.js` **3b** Multi-turn after disconnect (assertion). Track fixes in [E2E-OPENAI-FAILURES-TRACKING.md](./E2E-OPENAI-FAILURES-TRACKING.md). **Re-run or debug** these three before treating OpenAI proxy E2E as fully qualified; optionally retry with `workers: 1` / headed trace per [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md).
- **Outstanding before publish:** Green **E2E** per your bar (full root suite vs OpenAI slice only); then GitHub Release → CI publish → tag → merge PR.
- **Publish:** _not started_
- **Post-release:** _not started_

---

### Pre-Release Preparation

- [x] **Code review complete:** Intended commits on `release/v0.11.0`; no stray changes.
- [ ] **Tests passing** _(E2E below still required)_
  - [x] **Run what CI runs:** `npm run lint` then `npm run test:mock`
  - [x] **Full Jest suite (required):** `npm test` — **2026-04-09:** 142 suites passed, 1 skipped; 1291 tests passed
  - [ ] **E2E (proxy):** With **Vite + backend** running: (1) **Full:** repo root `USE_PROXY_MODE=true npm run test:e2e` — **2026-04-09 run: 93 failures** (mostly Deepgram-direct; see Progress). (2) **OpenAI-focused:** `cd test-app` then  
    `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true E2E_USE_HTTP=1 USE_REAL_APIS=1 npm run test:e2e:openai` — **2026-04-09: 3 failures** (callback ×2, openai-proxy **3b**); fix or flake-retry before checking this box.
  - [x] **Real-API integration:** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — **2026-04-09:** 20 passed (see Progress for transient 504 note)
  - [x] **Function-call path:** Covered by **Issue #470** real-API test in that file (backend HTTP contract per project tests)
  - [x] **Upstream event coverage:** `npm test -- tests/openai-proxy-event-coverage.test.ts`
- [x] **Linting clean:** `npm run lint`
- [x] **npm audit:** `npm audit --audit-level=high` — exit 0
- [x] **Documentation:** `docs/releases/v0.11.0/` created and validated; API evolution updated for v0.11.0
- [x] **Breaking changes:** **None** for component public API; no `MIGRATION.md` for this release

---

### Focused E2E (proxy)

Start **`npm run dev`** (test-app) and **`npm run backend`** (or `backend:log` from `packages/voice-agent-backend`) first. Prefer **`E2E_USE_EXISTING_SERVER=1`** so Playwright does not spawn a second Vite/backend.

| Scenario | Command |
|----------|---------|
| Full proxy E2E (repo root) | `USE_PROXY_MODE=true npm run test:e2e` |
| OpenAI proxy slice + real API (test-app cwd) | `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true E2E_USE_HTTP=1 USE_REAL_APIS=1 npm run test:e2e:openai` |
| Single OpenAI spec | `npm run test:e2e -- openai-proxy-e2e.spec.js` (from repo root; see README) |

See [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md) and [E2E-BACKEND-MATRIX.md](../../../test-app/tests/e2e/E2E-BACKEND-MATRIX.md).

---

### Version Management

- [x] Root `package.json` version **0.11.0**
- [x] `packages/voice-agent-backend/package.json` version **0.2.12**
- [ ] Optional: `npm update` per release policy

---

### Build and Package

- [x] Rely on **CI** for publish builds; do not commit `dist/` or `.tgz` (`dist/` gitignored)
- [x] Optional local: `npm run clean && npm run build && npm run validate` — **2026-04-09** pass

---

### Documentation (`docs/releases/v0.11.0/`)

- [x] `CHANGELOG.md` — Keep a Changelog; link #570 and merged PRs/issues
- [x] `PACKAGE-STRUCTURE.md` — aligned with v0.10.6 layout + minor doc set
- [x] **Minor:** `NEW-FEATURES.md`, `API-CHANGES.md`, `EXAMPLES.md`; no `MIGRATION.md` (no breaking API)
- [x] Validate: `npm run validate:release-docs 0.11.0`

---

### Git Operations

- [x] Commit version bump and release docs — `chore: prepare release v0.11.0 (Issue #570)` (`e0c3152e`) + follow-up checklist commits on **`release/v0.11.0`**
- [x] Branch **`release/v0.11.0`**, push — `git push origin issue-570 release/v0.11.0` **2026-04-09**
- [ ] `npm run release:issue 0.11.0 minor` — **skipped** (GitHub issue #570 already exists)

---

### Package Publishing

- [x] **Bump committed on `release/v0.11.0`** before creating the GitHub Release
- [ ] GitHub Release **tag `v0.11.0`**, target **`release/v0.11.0`** (not `main` until merged)
- [ ] CI **Test and Publish** workflow success; both packages at intended versions in GitHub Packages
- [ ] **`latest` dist-tag** on each package actually published (see template / workflow; manual fallback if needed)

```bash
# Example — use exact versions from the Overview table after publish
npm dist-tag add @signal-meaning/voice-agent-react@0.11.0 latest --registry https://npm.pkg.github.com
# npm dist-tag add @signal-meaning/voice-agent-backend@<version> latest --registry https://npm.pkg.github.com
```

---

### Post-Release

- [ ] Merge **`release/v0.11.0` → `main` via Pull Request**
- [ ] Close **GitHub Issue #570** when complete; update [README.md](./README.md) status if you sync folder with GitHub

---

### Completion Criteria

- [ ] Lint, `test:mock`, **full `npm test`**, and **proxy E2E** green; **CI** test + publish jobs green _(local Jest + real-API done; E2E + CI pending)_
- [x] Real-API integration documented here and on **#570** when applicable _(E2E: re-run with backend, then note on issue)_
- [x] `docs/releases/v0.11.0/` validated (`npm run validate:release-docs 0.11.0`)
- [ ] Packages published from **`release/v0.11.0`**
- [ ] **`latest` dist-tags** correct for published packages
- [ ] **`release/v0.11.0` merged to `main`**
- [ ] Issue #570 closed

---

### References

- [README.md](./README.md)
- [RELEASE-CONTEXT.md](./RELEASE-CONTEXT.md)
- [TRACKING.md](./TRACKING.md)
- [PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md)
- [docs/development/TEST-STRATEGY.md](../../development/TEST-STRATEGY.md)
