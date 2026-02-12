# Release v0.8.3 — Checklist (Issue #435)

**Branch:** `davidrmcgee/issue435`  
**GitHub:** [Issue #435 — Quick Release v0.8.3](https://github.com/Signal-Meaning/dg_react_agent/issues/435)  
**Type:** Patch release

---

## Overview

This checklist tracks the v0.8.3 patch release. Main change: **Issue #433** — enforce no send until channel ready (queue `injectUserMessage` until SettingsApplied/session.created). Also includes log-level reporting (backend, proxy, component).

---

## Pre-Release

- [x] **Tests passing**
  - [x] Run: `npm run test:mock` — 90 suites, 899 tests passed
  - [ ] (Optional) E2E in proxy mode: `cd test-app && npm run backend` then `USE_PROXY_MODE=true npm run test:e2e`
- [x] **Lint clean**
  - [x] Run: `npm run lint`

---

## Version & release docs

- [x] **Bump version to 0.8.3**
  - [x] Updated `package.json` to `"version": "0.8.3"`
- [x] **Create release documentation**
  - [x] Create: `docs/releases/v0.8.3/` directory
  - [x] Create: `CHANGELOG.md` (Keep a Changelog format; include #433, log-level reporting)
  - [x] Create: `RELEASE-NOTES.md` (short summary and install instructions)
  - [x] Create: `PACKAGE-STRUCTURE.md` from template (v0.8.3)
- [x] **Validate release docs**
  - [x] Run: `npm run validate:release-docs 0.8.3` — passed

---

## Commit and release branch

- [x] **Commit**
  - [x] Message: `chore: prepare release v0.8.3`
- [x] **Create release branch**
  - [x] Create: `release/v0.8.3` from davidrmcgee/issue435
  - [x] Push: `git push origin release/v0.8.3`

---

## Publish

- [ ] **Trigger CI publish**
  - [ ] Push to `release/v0.8.3` runs `.github/workflows/test-and-publish.yml` (test then publish)
  - Or: Actions → Test and Publish Package → Run workflow → branch `release/v0.8.3`
- [ ] **Verify**
  - [ ] Workflow completes; both packages published to GitHub Package Registry
  - [ ] GitHub Release created (tag `v0.8.3`, notes from `docs/releases/v0.8.3/RELEASE-NOTES.md`)

---

## Post-Release

- [ ] **Merge to main**
  - [ ] Open PR: `release/v0.8.3` → `main` (or merge locally and push)
  - [ ] Merge and push `main`
- [ ] **Close issue #435** when all steps are done

---

## References

- [Issue #435](https://github.com/Signal-Meaning/dg_react_agent/issues/435)
- [Issue #433](../../ISSUE-433/README.md) — no send until ready
- [Quick release template](https://github.com/Signal-Meaning/dg_react_agent/blob/main/.github/ISSUE_TEMPLATE/quick-release.md)
