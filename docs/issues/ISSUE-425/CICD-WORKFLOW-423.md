# CI/CD workflow work to accommodate Issue #423 (voice-agent-backend)

**Context:** Issue #423 added a publishable package `@signal-meaning/voice-agent-backend` in `packages/voice-agent-backend`. The current CI workflow (`.github/workflows/test-and-publish.yml`) only tests, builds, and publishes the **root** package `@signal-meaning/deepgram-voice-interaction-react`. This document enumerates the work required so the workflow supports the new package.

**Relevant workflow:** `.github/workflows/test-and-publish.yml`  
**Relevant action:** `.github/actions/prelim/` (Node, install, build — applies to repo root only)

---

## 1. Testing

| Item | Status / Action |
|------|------------------|
| **Unit/integration tests for voice-agent-backend** | Already covered: tests live in repo root (`tests/voice-agent-backend-api.test.ts`, `tests/integration/voice-agent-backend-*.ts`) and are run by the existing **test-jest** job via `npm run test:mock`. No change required unless we want to run backend tests in isolation from `packages/voice-agent-backend`. |
| **E2E** | E2E remain disabled in CI; test-app (which uses the backend package in-process) is not built in CI. Optional future: add a job to build test-app and run E2E with mocks. |

**Conclusion:** No mandatory test-job changes for #423. Optional: add an explicit step or note that voice-agent-backend tests are included in `npm run test:mock`.

---

## 2. Build

| Item | Status / Action |
|------|------------------|
| **Root package** | Already built in **prelim** via `npm run build`. No change. |
| **voice-agent-backend** | No build step required: package is JS-only (`main: "src/index.js"`), no `build` script. No compiled artifacts. Optional: add `npm pack --dry-run` in test job to validate package contents. |

**Conclusion:** No build step needed for `packages/voice-agent-backend`. Optional: in test-jest, add a step that runs `npm pack --dry-run` (or equivalent) in `packages/voice-agent-backend` to catch packaging issues early.

---

## 3. Package publishing (voice-agent-backend)

| Item | Action |
|------|--------|
| **Publish backend package** | Add steps (or a dedicated job) to publish `@signal-meaning/voice-agent-backend` from `packages/voice-agent-backend`. |
| **When to publish** | Decide trigger: e.g. on same events as root (release published, push to `release/v*`, workflow_dispatch), or only when backend version/contents change (e.g. when files under `packages/voice-agent-backend/` change). |
| **Version source** | Use version from `packages/voice-agent-backend/package.json` (currently `0.1.0`). No need to tie to root version unless we adopt a mono-repo versioning policy. |
| **Auth / registry** | Same `secrets.NPM_TOKEN` and `@signal-meaning` scope; registry already set in publish job. Ensure `npm publish` runs with CWD `packages/voice-agent-backend` and that `.npmrc` (or env) is valid for that directory. |
| **Idempotency** | Mirror root behavior: check if `@signal-meaning/voice-agent-backend@<version>` already exists; skip publish (or fail) unless force flag is used. |
| **Post-publish verification** | Optional: add a step to install `@signal-meaning/voice-agent-backend` from the registry and run a quick smoke test (e.g. `require('@signal-meaning/voice-agent-backend')` or run CLI `voice-agent-backend serve --help`). |

**Concrete steps (to implement):**

1. In the **publish** job, after publishing the root package (or in parallel, if split into two jobs):
   - `cd packages/voice-agent-backend`
   - Optionally: check if current version already exists (`npm view @signal-meaning/voice-agent-backend@<version>`); skip or respect force.
   - Run `npm publish` (with same registry/auth as root).
2. Optionally: add a “Verify voice-agent-backend installation” step that installs the backend package from the registry and runs a minimal check.

---

## 4. Versioning strategy

| Option | Description |
|--------|-------------|
| **A. Independent versions** | Root and backend each have their own version in their `package.json`. Release process: bump root for component releases; bump backend when backend changes. CI publishes each from its own directory with its own version. |
| **B. Locked to root** | Backend version derived from root (e.g. same as root or a suffix). Requires a step to set backend version before publish (e.g. from env or script). |

**Recommendation:** Start with **Option A** (independent versions). Simpler and matches current layout. Document in release checklist that we may release component only, backend only, or both in one release.

---

## 5. Workflow structure options

| Approach | Pros | Cons |
|----------|------|------|
| **Single publish job, two publish steps** | One job; two `npm publish` steps (root, then `packages/voice-agent-backend`). Same secrets and env. | Job output is longer; version logic for backend lives in same job. |
| **Two publish jobs** | Clear separation; can conditionally run backend publish (e.g. only when `packages/voice-agent-backend` changes). | Duplicate checkout/prelim/auth; more YAML. |

**Recommendation:** Single publish job with two publish steps is sufficient for the first iteration. If we later add “publish backend only when its files change,” we can split or add path filters.

---

## 6. Secrets and permissions

| Item | Status / Action |
|------|------------------|
| **NPM_TOKEN** | Already used for root publish; same token can publish any `@signal-meaning` package. Ensure token has `write:packages` and access to the org. No new secret required. |
| **GITHUB_TOKEN** | Used for creating releases; unchanged. |
| **Job permissions** | Publish job already has `packages: write`. No change. |

---

## 7. Release checklist and documentation

| Item | Action |
|------|--------|
| **Release checklist template** | Update `.github/ISSUE_TEMPLATE/release-checklist.md` to mention that a release may include one or both packages, and that CI publishes both when the workflow is run (after this work is done). |
| **Release docs** | In release notes/CHANGELOG, document when `@signal-meaning/voice-agent-backend` was first published and its version. |
| **Backend README** | Ensure `packages/voice-agent-backend/README.md` includes install from GitHub Packages (registry config and `npm install @signal-meaning/voice-agent-backend`). |

---

## 8. Summary checklist (implementation)

- [x] **Test job:** Added step to run `npm pack --dry-run` in `packages/voice-agent-backend` (validates package contents).
- [x] **Publish job:** Added steps to publish `packages/voice-agent-backend` (version from its `package.json`, same NPM_TOKEN/registry).
- [x] **Version check:** Check if backend version already exists; skip publish unless force input is set (consistent with root).
- [x] **Post-publish:** Verify installation of `@signal-meaning/voice-agent-backend` from registry after publish.
- [x] **Docs:** Updated release checklist template to mention both packages; added Install/registry section to backend README.
- [x] **Versioning:** Independent versions (Option A) documented in release checklist template.

---

## 9. Files to touch

- `.github/workflows/test-and-publish.yml` — main changes (publish steps, optional test step).
- `.github/ISSUE_TEMPLATE/release-checklist.md` — optional wording for “two packages.”
- `packages/voice-agent-backend/README.md` — ensure install/registry section is present and correct.
