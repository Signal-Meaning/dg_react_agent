# Issue #571: Release checklist — patch (backend relay fix)

**GitHub:** [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571)

**Scope:** Patch shipping **Issue #571** — `createOpenAIWss` queues client→upstream WebSocket frames until the upstream socket is `OPEN` (matches `createDeepgramWss`). Fixes lost **Settings** when the browser connects through the Express relay before the translator handshake completes.

**Authoritative checklist:** Mirror [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md) on the GitHub release issue (if you open one) or on **#571**. This file is the **repo-local** companion: versions, paths, and commands.

**Publishing note:** Per [docs/PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md), the GitHub Release tag **`vX.X.X`** follows the **root** component version. This checklist assumes a **coordinated patch**: bump **both** packages so tag **`v0.11.1`** matches root **`0.11.1`** and **`@signal-meaning/voice-agent-backend`** ships **`0.2.13`**. If you intentionally ship **backend only**, document that on #571 and adjust branch/tag steps with maintainers (CI publishes both packages when the workflow runs).

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

**Documentation set (patch):** `docs/releases/v0.11.1/` — `CHANGELOG.md`, `PACKAGE-STRUCTURE.md` (from [docs/releases/PACKAGE-STRUCTURE.template.md](../../releases/PACKAGE-STRUCTURE.template.md)), optional `RELEASE-NOTES.md`. No `MIGRATION.md` unless a breaking change is discovered.

### Progress

_(Fill in as you execute the release.)_

- **Pre-publish:** _dates / PR / branch_
- **Qualification:** _OpenAI proxy integration / E2E slice if run_
- **Publish:** _GitHub Release ref, workflow run URL_
- **Post-release:** _merge `release/v0.11.1` → `main`, close #571, sync issue docs_

---

### Pre-merge (before `release/v0.11.1`)

- [ ] **#571 fix on `main`:** PR merged that contains the queue fix + Jest test (or equivalent), linked to **#571**.
- [ ] **Code review complete** on the merge commit that will be released.

---

### Pre-Release Preparation

- [ ] **Tests passing**
  - [ ] **CI bar:** `npm run lint` then `npm run test:mock`
  - [ ] **Issue #571 unit test:** `npm test -- tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js`
  - [ ] **Attach-upgrade / #441:** `npm test -- tests/voice-agent-backend-attach-upgrade-upstream.test.ts`
  - [ ] **Full Jest (recommended):** `npm test`
  - [ ] **Relay / proxy timing (recommended when `OPENAI_API_KEY` available):**  
    `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
  - [ ] **Upstream event coverage:** `npm test -- tests/openai-proxy-event-coverage.test.ts`
  - [ ] **OpenAI proxy E2E slice (recommended):** from **`test-app`**, with backend + dev server running (`npm run backend`, `npm run dev`), e.g.  
    `E2E_USE_EXISTING_SERVER=1 USE_PROXY_MODE=true E2E_USE_HTTP=1 USE_REAL_APIS=1 npm run test:e2e:openai`  
    See [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md).
- [ ] **Linting clean:** `npm run lint`
- [ ] **npm audit:** `npm audit --audit-level=high` — exit 0
- [ ] **Breaking changes:** None expected; if any surface, document in `docs/API-REFERENCE.md` and release notes

---

### Version Management

- [ ] Root `package.json` (and root lockfile if applicable) → **0.11.1**
- [ ] `packages/voice-agent-backend/package.json` → **0.2.13**
- [ ] Any workspace consumer that pins backend (e.g. test-app) updated if your policy requires a strict range bump

---

### Documentation (`docs/releases/v0.11.1/`)

- [ ] `CHANGELOG.md` — link **#571**; describe relay queue fix
- [ ] `PACKAGE-STRUCTURE.md` — from template; placeholders for **0.11.1**
- [ ] Optional: `RELEASE-NOTES.md`
- [ ] Validate: `npm run validate:release-docs 0.11.1`

---

### Build and Package

- [ ] Rely on **CI** for publish builds; do not commit `dist/` or `.tgz`
- [ ] Optional local: `npm run clean && npm run build && npm run validate`

---

### Git Operations

- [ ] Branch **`release/v0.11.1`** from the commit that includes version bumps + `docs/releases/v0.11.1/`
- [ ] Push: `git push -u origin release/v0.11.1`
- [ ] **Do not delete** `release/v0.11.1` after merge (per project policy)

---

### Package Publishing

- [ ] GitHub **Release** with tag **`v0.11.1`** targeting **`release/v0.11.1`** (not `main` until versions exist on that branch)
- [ ] CI **Test and Publish** workflow green; both packages at **0.11.1** / **0.2.13**
- [ ] Confirm **`latest`** dist-tags on GitHub Packages if policy requires a manual check

```bash
# Example after publish — use exact versions from the Overview table
npm dist-tag add @signal-meaning/voice-agent-react@0.11.1 latest --registry https://npm.pkg.github.com
npm dist-tag add @signal-meaning/voice-agent-backend@0.2.13 latest --registry https://npm.pkg.github.com
```

---

### Post-Release

- [ ] PR **merge `release/v0.11.1` → `main`** (or documented fast-forward)
- [ ] Close **GitHub #571** with resolution summary
- [ ] Sync [README.md](./README.md) / [CURRENT-STATUS.md](./CURRENT-STATUS.md) to **Closed** if you keep issue folders aligned with GitHub

---

### Completion Criteria

- [ ] Lint + `test:mock` + targeted tests above green; full `npm test` green if used as bar
- [ ] Real-API integration and/or OpenAI E2E slice run when qualifying proxy relay behavior (document exceptions on #571)
- [ ] `docs/releases/v0.11.1/` validated
- [ ] Packages published from **`release/v0.11.1`** / tag **`v0.11.1`**
- [ ] **`release/v0.11.1`** merged to **`main`**; **#571** closed

---

### References

- [README.md](./README.md) — defect description and code pointers
- [CURRENT-STATUS.md](./CURRENT-STATUS.md) — implementation snapshot
- [NEXT-STEP.md](./NEXT-STEP.md) — PR / close-out
- [docs/PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md)
- [docs/development/TEST-STRATEGY.md](../../development/TEST-STRATEGY.md)
