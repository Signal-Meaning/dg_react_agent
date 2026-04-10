# Issue #571: Release checklist — patch (backend relay fix)

**Status:** **Complete** — **v0.11.1** / backend **0.2.13** published **2026-04-10**; **`main`** updated via [#573](https://github.com/Signal-Meaning/dg_react_agent/pull/573).

**GitHub:** [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571) — **closed** when [#572](https://github.com/Signal-Meaning/dg_react_agent/pull/572) merged (**2026-04-10**).

**Scope:** Patch shipping **Issue #571** — `createOpenAIWss` queues client→upstream WebSocket frames until the upstream socket is `OPEN` (matches `createDeepgramWss`). Fixes lost **Settings** when the browser connects through the Express relay before the translator handshake completes.

**Authoritative checklist:** Mirror [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md) on the GitHub release issue (if you open one). This file is the **repo-local** companion: versions, paths, and commands.

**Publishing note:** Per [docs/PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md), the GitHub Release tag **`vX.X.X`** follows the **root** component version. This checklist uses a **coordinated patch**: bump **both** packages so tag **`v0.11.1`** matches root **`0.11.1`** and **`@signal-meaning/voice-agent-backend`** ships **`0.2.13`**.

---

## Release v0.11.1 (component) and 0.2.13 (backend)

### Overview

**Release type:** **Patch** (bug fix; no intentional breaking API change).

**Packages:**

| Package | Location | Version for this release |
|---------|----------|--------------------------|
| **@signal-meaning/voice-agent-react** | Root `package.json` | **0.11.1** (Git tag **`v0.11.1`**, branch **`release/v0.11.1`**) |
| **@signal-meaning/voice-agent-backend** | `packages/voice-agent-backend/package.json` | **0.2.13** |

**CHANGELOG entry (Issue #571):** Patch release — OpenAI relay (`createOpenAIWss` in `packages/voice-agent-backend/src/attach-upgrade.js`) queues client messages until upstream WebSocket is open, preventing dropped **Settings** and stuck sessions when clients use the backend upgrade path (browser → relay → translator). Regression test: `tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js`.

**Documentation set (patch):** `docs/releases/v0.11.1/` — `CHANGELOG.md`, `PACKAGE-STRUCTURE.md`, `RELEASE-NOTES.md`.

### Progress

- **PR (fix + docs):** [#572](https://github.com/Signal-Meaning/dg_react_agent/pull/572) — merged to **`main`** **2026-04-10** (**Closes #571**).
- **Release branch prep (2026-04-10):** Branch **`release/v0.11.1`** with version bumps (**0.11.1** / **0.2.13**) and **`docs/releases/v0.11.1/`**; local validation (`validate:release-docs`, audit, lint, `test:mock`, targeted Jest).
- **Publish (2026-04-10):** GitHub **[Release v0.11.1](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.11.1)** from **`release/v0.11.1`**. CI **[Test and Publish Package](https://github.com/Signal-Meaning/dg_react_agent/actions/runs/24249265463)** — **success** (Jest + publish + **`latest`** dist-tags per workflow).
- **Mergeback (2026-04-10):** [#573](https://github.com/Signal-Meaning/dg_react_agent/pull/573) **`release/v0.11.1` → `main`** merged — **`main`** at **0.11.1** / **0.2.13** with `docs/releases/v0.11.1/`.
- **Optional follow-up:** Real-API integration / OpenAI E2E slice when you want extra qualification beyond CI (document if skipped).

---

### Pre-merge (before `release/v0.11.1`)

- [x] **#571 fix on `main`:** [#572](https://github.com/Signal-Meaning/dg_react_agent/pull/572) merged (queue fix + Jest test).
- [x] **Code review complete** on #572.

---

### Pre-Release Preparation

- [x] **Tests passing** _(release bar on **`release/v0.11.1`**, 2026-04-10)_
  - [x] **CI bar:** `npm run lint` then `npm run test:mock`
  - [x] **Issue #571 unit test:** `npm test -- tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js`
  - [x] **Attach-upgrade / #441:** `npm test -- tests/voice-agent-backend-attach-upgrade-upstream.test.ts`
  - [ ] **Full Jest (recommended):** `npm test`
  - [ ] **Relay / proxy timing (when `OPENAI_API_KEY` available):**  
    `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
  - [x] **Upstream event coverage:** `npm test -- tests/openai-proxy-event-coverage.test.ts`
  - [ ] **OpenAI proxy E2E slice (recommended):** from **`test-app`**, with backend + dev server running (`npm run backend`, `npm run dev`), e.g.  
    `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true E2E_USE_HTTP=1 USE_REAL_APIS=1 npm run test:e2e:openai`  
    See [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md).
- [x] **Linting clean:** `npm run lint`
- [x] **npm audit:** `npm audit --audit-level=high` — exit 0
- [x] **Breaking changes:** None; no `MIGRATION.md`

---

### Version Management

- [x] Root `package.json` → **0.11.1** _(root `package-lock.json` unchanged — no workspace pin of backend version)_
- [x] `packages/voice-agent-backend/package.json` → **0.2.13**
- [x] **test-app:** uses `../packages/voice-agent-backend` via npm scripts — **no** `package.json` range bump required

---

### Documentation (`docs/releases/v0.11.1/`)

- [x] `CHANGELOG.md` — links **#571**, **#572**; relay queue fix
- [x] `PACKAGE-STRUCTURE.md` — **v0.11.1** / backend **0.2.13** (no `vX.X.X` placeholders)
- [x] `RELEASE-NOTES.md`
- [x] Validate: `npm run validate:release-docs 0.11.1`

---

### Build and Package

- [x] **CI** publish builds — **Test and Publish** on tag **v0.11.1**; do not commit `dist/` or `.tgz`
- [ ] Optional local: `npm run clean && npm run build && npm run validate`

---

### Git Operations

- [x] Branch **`release/v0.11.1`** from **`main`** including version bumps + `docs/releases/v0.11.1/` + doc updates under `docs/issues/ISSUE-571/`
- [x] Push: `git push -u origin release/v0.11.1` — **2026-04-10**
- [x] **Do not delete** `release/v0.11.1` after merge (per project policy) — branch retained on `origin`

---

### Package Publishing

- [x] GitHub **Release** with tag **`v0.11.1`** targeting **`release/v0.11.1`** — [releases/tag/v0.11.1](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.11.1)
- [x] CI **Test and Publish** workflow green; both packages **0.11.1** / **0.2.13** — [run 24249265463](https://github.com/Signal-Meaning/dg_react_agent/actions/runs/24249265463)
- [x] **`latest`** dist-tags applied in workflow (verify on registry if policy requires a manual spot-check)

```bash
# Example after publish — use exact versions from the Overview table
npm dist-tag add @signal-meaning/voice-agent-react@0.11.1 latest --registry https://npm.pkg.github.com
npm dist-tag add @signal-meaning/voice-agent-backend@0.2.13 latest --registry https://npm.pkg.github.com
```

---

### Post-Release

- [x] PR **merge `release/v0.11.1` → `main`** — [#573](https://github.com/Signal-Meaning/dg_react_agent/pull/573) merged **2026-04-10**
- [x] **GitHub #571** — **closed** on #572 merge (no further action)

---

### Completion Criteria

- [x] Lint + `test:mock` + targeted proxy tests green on release branch _(full `npm test` optional)_
- [ ] Real-API integration and/or OpenAI E2E slice _(optional extra qualification; CI used mocks)_
- [x] `docs/releases/v0.11.1/` validated
- [x] Packages published from **`release/v0.11.1`** / tag **`v0.11.1`**
- [x] **`release/v0.11.1`** merged to **`main`** via [#573](https://github.com/Signal-Meaning/dg_react_agent/pull/573)

---

### References

- [README.md](./README.md) — defect description and code pointers
- [CURRENT-STATUS.md](./CURRENT-STATUS.md) — implementation snapshot
- [NEXT-STEP.md](./NEXT-STEP.md) — publish / mergeback
- [docs/PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md)
- [docs/development/TEST-STRATEGY.md](../../development/TEST-STRATEGY.md)
