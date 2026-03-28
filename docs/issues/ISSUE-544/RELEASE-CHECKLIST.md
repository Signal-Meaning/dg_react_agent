# Issue #544: Release checklist — v0.10.5 / backend 0.2.10 (Epic #542)

**GitHub:** [#544](https://github.com/Signal-Meaning/dg_react_agent/issues/544)

**Scope:** Patch release shipping Epic [#542](../ISSUE-542/README.md) (Voice Commerce OpenAI proxy §1–§6), merged on `main` via [#543](https://github.com/Signal-Meaning/dg_react_agent/pull/543). Surfaces: OpenAI proxy (`server.ts`, `translator.ts`, logging, client JSON hardening), React component and Settings/builder alignment, Jest integration and real-API tests, `docs/BACKEND-PROXY` and proxy protocol docs.

**Authoritative checklist:** Checkboxes on **GitHub Issue #544** mirror [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md). This file is the **repo-local** companion: fixed versions, paths, and focused commands.

---

## Release v0.10.5 (component) and 0.2.10 (backend)

### Overview

**Release type:** Patch (bug fixes and protocol alignment; no breaking API change intended).

**Packages:** Bump and publish **both** unless you explicitly ship one package only (document that decision in [TRACKING.md](./TRACKING.md) and on Issue #544).

| Package | Location | Version for this release |
|---------|----------|--------------------------|
| **@signal-meaning/voice-agent-react** | Root `package.json` | **0.10.5** (tag **v0.10.5**) |
| **@signal-meaning/voice-agent-backend** | `packages/voice-agent-backend/package.json` | **0.2.10** |

**CHANGELOG entry (Issue #544):** Patch release delivering Epic #542: Voice Commerce OpenAI proxy defect register (§1–§6) — proxy logging, client JSON boundary, `session` mapping from Settings, ordering and `SettingsApplied` behavior, component alignment, tests and BACKEND-PROXY / protocol documentation. Implementation merged in PR #543.

### Progress

**Pre-publish (2026-03-21)** — on **`issue-544`** / **`release/v0.10.5`**:

- Bumped **0.10.5** (root + `package-lock.json`) and **0.2.10** (`packages/voice-agent-backend/package.json`).
- Added **`docs/releases/v0.10.5/`** (`CHANGELOG.md`, `RELEASE-NOTES.md`, `PACKAGE-STRUCTURE.md`).
- Ran **`npm run validate:release-docs 0.10.5`**, **`npm run lint`**, **`npm run test:mock`**, **`npm audit --audit-level=high`** — all passed.
- Ran **`npm test -- tests/openai-proxy-event-coverage.test.ts`** — pass.
- Ran **`npm run build`** and **`npm run validate`** (optional local) — pass; `dist/` not committed.
- Pushed **`issue-544`** and **`release/v0.10.5`** to `origin`.
- Updated **`.github/ISSUE_TEMPLATE/release-checklist.md`**: GitHub Release must **target `release/vX.X.X`**, not `main`.
- Proxy E2E blockers addressed per [TDD-PLAN-E2E-EIGHT-FAILURES.md](./TDD-PLAN-E2E-EIGHT-FAILURES.md) (targeted six-spec run **16 passed**); optional: full `USE_PROXY_MODE=true npm run test:e2e` for **0 failures**.

**Publish (2026-03-22)** — completed:

- GitHub **Release [v0.10.5](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.10.5)** published (target **`release/v0.10.5`**).
- Workflow **[Test and Publish Package](https://github.com/Signal-Meaning/dg_react_agent/actions/workflows/test-and-publish.yml)** run [**23392304761**](https://github.com/Signal-Meaning/dg_react_agent/actions/runs/23392304761) — **success** (~2m31s).
- **Post-release still open:** merge **`release/v0.10.5` → `main` via PR** (as of this update, release branch commits are not yet on `main`); then close **GitHub Issue #544** and confirm **`latest`** dist-tags on both packages if not already.

---

### Pre-Release Preparation

- [x] **Code review complete:** Release branch contains only intended commits; Epic work already reviewed in PR #543.
- [x] **Tests passing** (pre-publish + CI)
  - [x] **Run what CI runs:** `npm run lint` then `npm run test:mock`
  - [ ] Optional: `npm test` (full suite — extra local pass)
  - [x] **E2E (proxy / Issue #544 blockers):** Targeted specs green — see [TDD-PLAN-E2E-EIGHT-FAILURES.md](./TDD-PLAN-E2E-EIGHT-FAILURES.md) and [TRACKING.md](./TRACKING.md). Optional follow-up: full `USE_PROXY_MODE=true npm run test:e2e` from `test-app`.
  - [x] **Real-API integration:** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — pass during qualification (20 ran, 64 skipped); function-call / backend-HTTP rules per [ISSUE-462](../ISSUE-462/VOICE-COMMERCE-FUNCTION-CALL-REPORT.md) still apply for partner scenarios.
  - [x] **Upstream event coverage:** `npm test -- tests/openai-proxy-event-coverage.test.ts`
- [x] **Linting clean:** `npm run lint`
- [x] **npm audit:** `npm audit --audit-level=high` — exit 0
- [x] **Documentation:** `docs/releases/v0.10.5/` created and validated; Issue #544 docs updated if process notes changed
- [x] **API / breaking changes:** Patch expectation is **none**; if anything surfaces, document in `docs/API-REFERENCE.md` and release notes

---

### Focused E2E (proxy / partner paths)

Run from `test-app` with backend (and dev server if the spec requires it). Real API when qualifying upstream:

| Scenario | Command |
|----------|---------|
| Full proxy E2E | `USE_PROXY_MODE=true npm run test:e2e` |
| OpenAI proxy spec | `npm run test:e2e -- openai-proxy-e2e.spec.js` |
| Partner function-call flow (6b) | `E2E_USE_EXISTING_SERVER=1 USE_REAL_APIS=1 USE_PROXY_MODE=true npm run test:e2e -- openai-proxy-e2e.spec.js --grep '6b'` |

Adjust env to match [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md).

---

### Version Management

- [x] Root `package.json` version **0.10.5**
- [x] `packages/voice-agent-backend/package.json` version **0.2.10**
- [ ] Optional: `npm update` per release policy

---

### Build and Package

- [x] Rely on **CI** for publish builds; do not commit `dist/` or `.tgz`
- [x] Optional local: `npm run clean && npm run build && npm run validate` (build + validate run; `clean` omitted)

---

### Documentation (`docs/releases/v0.10.5/`)

- [x] `CHANGELOG.md` — Keep a Changelog; link #542, #543, #544
- [x] `PACKAGE-STRUCTURE.md` — from `docs/releases/PACKAGE-STRUCTURE.template.md` (placeholders replaced for **0.10.5**)
- [x] Optional patch artifact: `RELEASE-NOTES.md`
- [x] Validate: `npm run validate:release-docs 0.10.5`

---

### Git Operations

- [x] Commit version bump and release docs, e.g. `chore: prepare release v0.10.5 (Issue #544)`
- [x] Branch **`release/v0.10.5`**, push `git push origin release/v0.10.5`
- [ ] Preferred: `npm run release:issue 0.10.5 patch` if that matches your workflow and versions

---

### Package Publishing

- [x] **Bump committed on `release/v0.10.5`** before creating the GitHub Release
- [x] GitHub Release **tag `v0.10.5`**, target **`release/v0.10.5`** — [releases/tag/v0.10.5](https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.10.5) (published 2026-03-22)
- [x] CI workflow completed successfully ([run 23392304761](https://github.com/Signal-Meaning/dg_react_agent/actions/runs/23392304761); `workflow_dispatch` on `release/v0.10.5`)
- [x] Confirm both packages in GitHub Packages at **0.10.5** and **0.2.10** (verify in org **Packages** UI if needed)
- [x] **`latest` dist-tag** — workflow applies **`latest`** after publish (see *Apply latest dist-tag* steps in [test-and-publish.yml](../../../.github/workflows/test-and-publish.yml)). Manual fallback if a job was skipped:

```bash
npm dist-tag add @signal-meaning/voice-agent-react@0.10.5 latest --registry https://npm.pkg.github.com
npm dist-tag add @signal-meaning/voice-agent-backend@0.2.10 latest --registry https://npm.pkg.github.com
```

---

### Post-Release

- [x] Merge **`release/v0.10.5` → `main` via Pull Request** — [PR #545](https://github.com/Signal-Meaning/dg_react_agent/pull/545) merged 2026-03-28 (`df54a48`)
- [x] Close **GitHub Issue #544** — closed as **completed** with resolution comment

---

### Completion Criteria

- [x] Lint, `test:mock` green locally; CI test + publish jobs green
- [x] Real-API integration passed during qualification — see [TRACKING.md](./TRACKING.md)
- [x] `docs/releases/v0.10.5/` validated
- [x] Packages published from **`release/v0.10.5`** (v0.10.5 release + successful workflow)
- [x] **`latest` dist-tags** — applied by publish workflow (re-run manual commands above only if needed)
- [x] **`release/v0.10.5` merged to `main`** ([PR #545](https://github.com/Signal-Meaning/dg_react_agent/pull/545))
- [x] Issue #544 closed (completed); resolution recorded on the issue

---

### References

- [README.md](./README.md)
- [SCOPE.md](./SCOPE.md)
- [PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md)
- [docs/development/TEST-STRATEGY.md](../../development/TEST-STRATEGY.md)
