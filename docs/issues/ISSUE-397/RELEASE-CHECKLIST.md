# Release Checklist – Issue #397

**Release v0.7.14** – customer solution: **include source in package** (especially proxy source), **source reference documentation** directing customers to major source elements, and **simple release docs**.

**GitHub issue:** [Issue #397](https://github.com/Signal-Meaning/dg_react_agent/issues/397)

---

## Deliverables (scope)

1. **Source in package** — [x] Added `src/` to `package.json` `"files"`; `scripts/openai-proxy/` already included via `scripts/`.
2. **Source reference documentation** — [x] `docs/SOURCE-REFERENCE.md` added (component + proxy source, event order, links).
3. **Simple release docs** — [x] `docs/releases/v0.7.14/`: CHANGELOG, RELEASE-NOTES, PACKAGE-STRUCTURE; validated.

---

## Pre-Release

- [x] **Tests passing**
  - [x] Run: `npm test` (use `CI=true npm test` to match CI) — 75 suites, 817 passed
- [x] **Lint clean**
  - [x] Run: `npm run lint` — 0 errors
- [ ] **E2E in proxy mode** (optional for this release): skipped for now

---

## Version & build

- [x] **Bump version to v0.7.14**
  - [x] Run: `npm version patch --no-git-tag-version`
- [x] **Build** (CI builds on release; optional local verify)
  - [x] Skipped — CI will build on release

---

## Documentation

- [x] **Source reference doc** (deliverable 2)
  - [x] Created `docs/SOURCE-REFERENCE.md`: component entry, proxy (server.ts, translator.ts, run.ts, logger.ts), event order explanation, Deepgram test-app proxy; links to API-REFERENCE, BACKEND-PROXY, OPENAI-REALTIME-API-REVIEW, PROXY-OWNERSHIP-DECISION.
- [x] **Release docs** (deliverable 3)
  - [x] Create: `docs/releases/v0.7.14/`
  - [x] Create: `CHANGELOG.md`, `RELEASE-NOTES.md`, `PACKAGE-STRUCTURE.md`
- [x] **Validate release docs**
  - [x] Run: `npm run validate:release-docs 0.7.14` — passed
- [x] **Do not proceed to Release until docs are complete**

---

## Release

- [ ] **Commit release prep**
  - [ ] Commit: version bump, `package.json` `files` (add `src/`), source reference doc, release docs
  - [ ] Message: `chore: prepare release v0.7.14 (source in package, source reference docs)`
- [ ] **Release branch**
  - [ ] `git checkout -b release/v0.7.14`
  - [ ] `git push origin release/v0.7.14`
- [ ] **Publish**
  - [ ] Create GitHub release to trigger CI (`.github/workflows/test-and-publish.yml`)
  - [ ] Monitor Actions; confirm package in GitHub Packages
  - [ ] Tag created with release (v0.7.14)
- [ ] **GitHub release**
  - [ ] Title: `v0.7.14`; description from CHANGELOG.md
  - [ ] Target: `release/v0.7.14`
- [ ] **Post-release**
  - [ ] Merge `release/v0.7.14` → `main` via PR

---

## Completion criteria

- [ ] Package includes `src/` and proxy source; customers can use shipped source as reference.
- [ ] Source reference documentation added/updated and in package.
- [ ] Package published to GitHub Package Registry.
- [ ] GitHub release v0.7.14 created.
- [ ] Release docs in `docs/releases/v0.7.14/` complete and validated.

---

## Important notes

- **Focus:** Customer solution — ship source (especially proxy) and direct customers to it via source reference docs. No change to proxy ownership/support scope in this release.
- **Version:** v0.7.14 (patch). Backward compatible; additive (more files in package, new/updated docs).
- Package publishes to **GitHub Package Registry**.
- CHANGELOG: Lead with “source in package” and “source reference documentation”; reference Issue #397.
