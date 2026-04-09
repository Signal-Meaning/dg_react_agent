# Issue #570: Release checklist — v0.11.0 (minor)

**GitHub:** [#570](https://github.com/Signal-Meaning/dg_react_agent/issues/570)

**Scope:** **Minor** release after **`v0.10.6`**: proxy/audio/test-app work on `main` (Issues **#559–#565**, **#561**; epic **#546** rollup). See [RELEASE-CONTEXT.md](./RELEASE-CONTEXT.md).

**Authoritative checklist:** Checkboxes on **GitHub Issue #570** mirror [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md). This file is the **repo-local** companion: fixed versions, paths, and focused commands (same pattern as [ISSUE-544/RELEASE-CHECKLIST.md](../ISSUE-544/RELEASE-CHECKLIST.md)).

---

## Release v0.11.0 (component) — backend TBD

### Overview

**Release type:** **Minor** (new backward-compatible behavior + fixes; confirm no unintended breaking changes in `API-REFERENCE.md` / `MIGRATION.md` if needed).

**Packages:** Bump and publish **both** unless you explicitly ship one package only (document in [TRACKING.md](./TRACKING.md) and on Issue #570).

| Package | Location | Version for this release |
|---------|----------|--------------------------|
| **@signal-meaning/voice-agent-react** | Root `package.json` | **0.11.0** (tag **v0.11.0**) |
| **@signal-meaning/voice-agent-backend** | `packages/voice-agent-backend/package.json` | **0.2.12** |

**Minor documentation set:** Per template, create **`docs/releases/v0.11.0/`** with `CHANGELOG.md`, `PACKAGE-STRUCTURE.md`, plus **NEW-FEATURES.md**, **API-CHANGES.md**, **EXAMPLES.md**; add **MIGRATION.md** only if breaking changes exist.

### Progress

- **Pre-publish (in progress):** `docs/releases/v0.11.0/` added; root **0.11.0** and backend **0.2.12** bumped; `npm run validate:release-docs 0.11.0`, `npm run lint`, `npm run test:mock`, and `npm audit --audit-level=high` passed locally; [API-REFERENCE.md](../../API-REFERENCE.md) evolution updated for v0.11.0. **Still required before publish:** full/proxy E2E, real-API integration when qualifying, upstream event coverage, Git operations / `release/v0.11.0` push, GitHub Release + CI publish.
- **Publish:** _not started_
- **Post-release:** _not started_

---

### Pre-Release Preparation

- [x] **Code review complete:** Intended commits on `release/v0.11.0`; no stray changes.
- [ ] **Tests passing**
  - [x] **Run what CI runs:** `npm run lint` then `npm run test:mock`
  - [ ] Optional: `npm test` (full suite)
  - [ ] **E2E (proxy):** `cd test-app && npm run backend`; from repo root `USE_PROXY_MODE=true npm run test:e2e` (or targeted specs per [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md))
  - [ ] **Real-API integration** (required for proxy/audio qualification when keys available): `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`
  - [ ] **Function-call path:** Real backend HTTP per [.cursorrules](../../../../.cursorrules) / [ISSUE-462](../ISSUE-462/VOICE-COMMERCE-FUNCTION-CALL-REPORT.md)
  - [ ] **Upstream event coverage:** `npm test -- tests/openai-proxy-event-coverage.test.ts`
- [x] **Linting clean:** `npm run lint`
- [x] **npm audit:** `npm audit --audit-level=high` — exit 0
- [x] **Documentation:** `docs/releases/v0.11.0/` created and validated; API evolution updated for v0.11.0
- [ ] **Breaking changes:** None expected; if any, `MIGRATION.md` + issue #570

---

### Focused E2E (proxy)

Run from **test-app** with backend (and dev server if the spec requires it):

| Scenario | Command |
|----------|---------|
| Full proxy E2E | `USE_PROXY_MODE=true npm run test:e2e` |
| OpenAI proxy spec | `npm run test:e2e -- openai-proxy-e2e.spec.js` |

See [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md).

---

### Version Management

- [x] Root `package.json` version **0.11.0**
- [x] `packages/voice-agent-backend/package.json` version **0.2.12**
- [ ] Optional: `npm update` per release policy

---

### Build and Package

- [ ] Rely on **CI** for publish builds; do not commit `dist/` or `.tgz`
- [ ] Optional local: `npm run clean && npm run build && npm run validate`

---

### Documentation (`docs/releases/v0.11.0/`)

- [x] `CHANGELOG.md` — Keep a Changelog; link #570 and merged PRs/issues
- [x] `PACKAGE-STRUCTURE.md` — aligned with v0.10.6 layout + minor doc set
- [x] **Minor:** `NEW-FEATURES.md`, `API-CHANGES.md`, `EXAMPLES.md`; no `MIGRATION.md` (no breaking API)
- [x] Validate: `npm run validate:release-docs 0.11.0`

---

### Git Operations

- [ ] Commit version bump and release docs, e.g. `chore: prepare release v0.11.0 (Issue #570)`
- [ ] Branch **`release/v0.11.0`**, push `git push origin release/v0.11.0`
- [ ] Preferred when versions match: `npm run release:issue 0.11.0 minor`

---

### Package Publishing

- [ ] **Bump committed on `release/v0.11.0`** before creating the GitHub Release
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

- [ ] Lint, `test:mock` green; CI test + publish jobs green
- [ ] Real-API integration (and E2E as required) documented on #570 when applicable
- [ ] `docs/releases/v0.11.0/` validated
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
