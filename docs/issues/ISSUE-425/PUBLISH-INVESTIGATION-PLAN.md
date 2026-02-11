# Proposal: Investigate and Resolve Two-Package Publishing in CI/CD

**Goal:** Get both `@signal-meaning/voice-agent-react` and `@signal-meaning/voice-agent-backend` publishing reliably from the workflow and visible under the **same repo’s** Packages (one repo, two packages — no separate repo for the backend).

### Progress log

| Step | Status | Date | Notes |
|------|--------|------|--------|
| 1. Add `repository` + `publishConfig` to backend `package.json` | ✅ Done | 2026-02-11 | Added `repository: "github:Signal-Meaning/dg_react_agent"` and `publishConfig` (registry + scope) to `packages/voice-agent-backend/package.json`. |
| 2. Run Publish Only workflow | ✅ Done | 2026-02-11 | Run 21912428446 (main). Result: voice-agent-react published; **voice-agent-backend still 401**. Repo linkage did not resolve. |
| 3. Add diagnostic step (section 2b/2c) | ✅ Done | 2026-02-11 | Added “Diagnose npm config (voice-agent-backend cwd)” to `publish-only.yml`: `npm config list` + `npm whoami` from `packages/voice-agent-backend` before publish. |
| 4. Re-run Publish Only and inspect diagnostic output | Next | — | If `npm whoami` fails in backend cwd → auth scope (2c). If it succeeds → registry/repo policy (2a/2d) or token org (section 4). |
| 5. Document final outcome | Pending | — | |

---

## 1. Token vs. “how we publish” the second package

Observed: the **same token** passes `npm whoami`, publishes the **root** package (`@signal-meaning/voice-agent-react`) successfully, then returns **401** when publishing the **second** package (`@signal-meaning/voice-agent-backend`). So the token is sufficient for the first publish; the issue is **how we are attempting to publish the second package**, not the token itself.

We do **not** have or want a separate repo for the backend; both packages must be published to the same repo’s Packages. The 401 on the backend publish suggests the registry is rejecting the **request** (e.g. missing repo linkage or wrong publish context), not the credentials in isolation.

---

## 2. Hypothesized root causes (second package only)

These focus on why **publishing @signal-meaning/voice-agent-backend** fails despite the same token and same job.

### 2a. Missing repo linkage in backend `package.json`

- **Fact:** Root `package.json` has `publishConfig` (registry + scope). Backend `packages/voice-agent-backend/package.json` has **no** `repository` and **no** `publishConfig`.
- **Hypothesis:** GitHub Packages ties each package to a **repository**. The first publish (root) runs from the repo root, so the workflow’s `GITHUB_REPOSITORY` / repo context may allow linkage. The second package is published from `packages/voice-agent-backend`; if the backend’s `package.json` does not declare `repository`, the registry may not associate this package name with this repo and may reject the PUT with 401 (“User cannot be authenticated with the token provided” can mean “this package is not allowed to be published in this context”).
- **Check:** Add `repository` (and optionally `publishConfig`) to `packages/voice-agent-backend/package.json` pointing at the **same** repo (e.g. `Signal-Meaning/dg_react_agent`). Then re-run Publish Only.

### 2b. Missing or different `publishConfig` in backend

- **Fact:** Root has `publishConfig.registry` and `@signal-meaning:registry`. Backend has none; it relies on job-level `.npmrc` after `cd packages/voice-agent-backend`.
- **Hypothesis:** In the subdirectory, npm might resolve config differently (e.g. a different registry or no auth for that scope), so the publish request goes to the right host but without the token, or with different scope rules, leading to 401.
- **Check:** Add `publishConfig` to the backend `package.json` to match the root (same registry and scope). Ensures the backend package always publishes to GitHub Packages with the same config regardless of cwd.

### 2c. Working directory and auth scope

- **Fact:** We run `npm publish` from `PACKAGE_DIR` (e.g. `packages/voice-agent-backend`). Auth is set in the job (e.g. `NPM_CONFIG_USERCONFIG`, `NODE_AUTH_TOKEN`) before the first publish; both publish steps run in the same job.
- **Hypothesis:** Less likely, but possible: after `cd packages/voice-agent-backend`, something (e.g. a local `.npmrc` or npm’s config cascade) overrides or strips auth for that directory. Then the second publish would be unauthenticated.
- **Check:** In the workflow, before the backend publish step, log `npm config list` and confirm `@signal-meaning:registry` and auth are still applied when cwd is `packages/voice-agent-backend`. Ensure no `.npmrc` in that directory overrides the job’s auth.

### 2d. “First package vs. new package name” in the same repo

- **Hypothesis:** The first package name might already be linked to this repo (from an earlier publish or UI). The second package name has never been published; creating a **new** package name under the org might require an explicit repo link in `package.json` so GitHub knows which repo “owns” it. Without that, the registry might reject the create with 401.
- **Check:** Same as 2a — add `repository` (and `publishConfig`) to the backend so both packages explicitly declare they belong to the same repo.

---

## 3. Recommended next steps (no token change)

1. **Add to `packages/voice-agent-backend/package.json`:**
   - `repository` — same repo as the root (e.g. `"repository": "github:Signal-Meaning/dg_react_agent"` or the same format the root uses if it has one).
   - `publishConfig` — same as root: `{ "registry": "https://npm.pkg.github.com", "@signal-meaning:registry": "https://npm.pkg.github.com" }`.
2. Re-run the **Publish Only** workflow (same branch, same token).
3. If 401 persists, add a workflow step before the backend publish to log `npm config list` and `npm whoami` from `packages/voice-agent-backend` (to validate 2b/2c).

---

## 4. Confirm token and permissions (optional / if 401 persists after above)

- **Check:** `NPM_TOKEN` is a classic PAT with **write:packages**; token user is in the org; org **Package creation** allows the visibility you use. See [PUBLISH-BACKEND-401-INVESTIGATION.md](./PUBLISH-BACKEND-401-INVESTIGATION.md).
- Only revisit token/org if repo linkage and publishConfig are in place and the second package still returns 401.

---

## 5. Isolate publish: use “Publish Only” workflow first (recommended)

- **Trigger:** Actions → **“Publish Only”** → Run workflow (optionally set branch, e.g. `release/v0.8.0`).
- **Why:** Runs only the publish job (checkout → prelim → auth → publish both packages → verify install → create release). No test job, so you get fast feedback on token/org settings and 401 resolution without running the full test suite.
- **Workflow file:** `.github/workflows/publish-only.yml` (same steps as the publish job in `test-and-publish.yml`).
- **After publish works here:** Run the full “Test and Publish Package” workflow (step 3) to confirm the full pipeline.

---

## 6. Run full workflow with publish (after publish-only succeeds)

- **Trigger:** Actions → “Test and Publish Package” → Run workflow from `release/v0.8.0` (or `main` after merge), **Run only test-jest** = unchecked.
- **Watch:** Publish job. For each package:
  - “Determine version” and “Check if version exists” (should be false if no packages published yet).
  - “Publish (voice-agent-react)” and “Publish (voice-agent-backend)” — both should run `npm publish` (no skip).
- **If 401:** Download the failed job log; confirm the failing step. Address repo linkage / publishConfig (sections 2–3) first; revisit token (section 4) only if needed.
- **If 409 (version exists):** Either the version was published in a prior run or another context. Use workflow input `force: true` only if you intend to overwrite (not recommended). Prefer bumping version and re-running.

**Exit criterion:** Both publish steps complete without 401/403; job succeeds.

---

## 7. Confirm packages on GitHub

- **Check:** Repo → **Packages** (right sidebar). You should see two packages:
  - `voice-agent-react` (or similar label for `@signal-meaning/voice-agent-react`)
  - `voice-agent-backend` (for `@signal-meaning/voice-agent-backend`)
- **Check:** Click each → verify version (e.g. 0.8.0 and 0.1.0) and that “Install” instructions match our docs.

**Exit criterion:** Both packages listed; install commands work for consumers.

---

## 8. Optional: local dry-run before CI

- **Root:** From repo root, `npm pack --dry-run` and (if you have a token) `npm publish --dry-run` (if supported) or a real publish to a test scope.
- **Backend:** `cd packages/voice-agent-backend && npm pack --dry-run`; same token check for publish.
- **Scripts:** Use `scripts/validate-publish-auth.js` or `scripts/test-npm-token-env.sh` with the same token you put in `NPM_TOKEN` to confirm `npm whoami` and `npm view` for both package names.

**Exit criterion:** No surprises in CI; token works for both package names from the same env.

---

## 9. Optional: make “version exists” check robust

- **Current:** `npm view <package>@<version>`; success → skip publish. If the registry is slow or cached, this can be wrong.
- **Options:** (a) Add a short retry/backoff for `npm view` before treating as “exists”. (b) Log the raw response when skipping. (c) In release runs, prefer “always attempt publish” and rely on 409 to skip (no pre-check). Trade-off: 409 is noisier but authoritative.
- **Recommendation:** Keep current logic; fix repo linkage first (section 3). Revisit only if we see spurious “version exists” or skips when the repo shows no packages.

---

## 10. Order of operations (summary)

1. **Add** `repository` and `publishConfig` to `packages/voice-agent-backend/package.json` (section 3) so the second package is linked to the same repo.
2. **Run** the **“Publish Only”** workflow (Actions → Publish Only) to test without the full test suite.
3. **Inspect** Publish job logs; if 401 on backend, verify repo linkage and add diagnostic steps (section 2b/2c); only then revisit token/org (section 4).
4. **Confirm** both packages under the repo’s Packages (same repo).
5. **Run** the full “Test and Publish Package” workflow (no test-only) to validate the full pipeline.
6. **Document** in this folder: “Publish verified on &lt;date&gt;; both packages visible.”

---

## References

- [PUBLISH-BACKEND-401-INVESTIGATION.md](./PUBLISH-BACKEND-401-INVESTIGATION.md) — 401 cause and token setup
- [CICD-WORKFLOW-423.md](./CICD-WORKFLOW-423.md) — Workflow layout and NPM_TOKEN note
- `.github/workflows/publish-only.yml` — Isolated publish workflow (run this first for investigation)
- `.github/workflows/test-and-publish.yml` — Full pipeline; publish job has same steps as publish-only
