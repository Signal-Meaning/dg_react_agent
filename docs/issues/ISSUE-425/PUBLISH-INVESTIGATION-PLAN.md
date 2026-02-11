# Proposal: Investigate and Resolve Two-Package Publishing in CI/CD

**Goal:** Get both `@signal-meaning/voice-agent-react` and `@signal-meaning/voice-agent-backend` publishing reliably from the workflow and visible under the repo’s Packages.

---

## 1. Confirm token and permissions (required)

- **Check:** `NPM_TOKEN` is a **classic** PAT with **write:packages** (and **read:packages** if the workflow installs from the registry).
- **Check:** Token user is in the `Signal-Meaning` org and the org allows package creation. **Where to find:** Profile picture (top right) → **Organizations** → next to the org click **Settings** → left sidebar under **Code, planning, and automation** click **Packages**. Under **Package creation** allow **Public**, **Private**, or **Internal** so members can publish. [Docs](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility#package-creation-visibility-for-organization-members).
- **Action:** If unsure, create a new classic PAT with `write:packages`, set it as the repo secret `NPM_TOKEN`, and re-run the workflow. See [PUBLISH-BACKEND-401-INVESTIGATION.md](./PUBLISH-BACKEND-401-INVESTIGATION.md) for step-by-step.

**Exit criterion:** Same token is used for both packages; 401 on one implies 401 on the other until token is fixed.

---

## 2. Isolate publish: use “Publish Only” workflow first (recommended)

- **Trigger:** Actions → **“Publish Only”** → Run workflow (optionally set branch, e.g. `release/v0.8.0`).
- **Why:** Runs only the publish job (checkout → prelim → auth → publish both packages → verify install → create release). No test job, so you get fast feedback on token/org settings and 401 resolution without running the full test suite.
- **Workflow file:** `.github/workflows/publish-only.yml` (same steps as the publish job in `test-and-publish.yml`).
- **After publish works here:** Run the full “Test and Publish Package” workflow (step 3) to confirm the full pipeline.

---

## 3. Run full workflow with publish (after publish-only succeeds)

- **Trigger:** Actions → “Test and Publish Package” → Run workflow from `release/v0.8.0` (or `main` after merge), **Run only test-jest** = unchecked.
- **Watch:** Publish job. For each package:
  - “Determine version” and “Check if version exists” (should be false if no packages published yet).
  - “Publish (voice-agent-react)” and “Publish (voice-agent-backend)” — both should run `npm publish` (no skip).
- **If 401:** Download the failed job log; confirm the failing step and the exact `npm publish` error. Fix token (step 1) and re-run.
- **If 409 (version exists):** Either the version was published in a prior run or another context. Use workflow input `force: true` only if you intend to overwrite (not recommended). Prefer bumping version and re-running.

**Exit criterion:** Both publish steps complete without 401/403; job succeeds.

---

## 4. Confirm packages on GitHub

- **Check:** Repo → **Packages** (right sidebar). You should see two packages:
  - `voice-agent-react` (or similar label for `@signal-meaning/voice-agent-react`)
  - `voice-agent-backend` (for `@signal-meaning/voice-agent-backend`)
- **Check:** Click each → verify version (e.g. 0.8.0 and 0.1.0) and that “Install” instructions match our docs.

**Exit criterion:** Both packages listed; install commands work for consumers.

---

## 5. Optional: local dry-run before CI

- **Root:** From repo root, `npm pack --dry-run` and (if you have a token) `npm publish --dry-run` (if supported) or a real publish to a test scope.
- **Backend:** `cd packages/voice-agent-backend && npm pack --dry-run`; same token check for publish.
- **Scripts:** Use `scripts/validate-publish-auth.js` or `scripts/test-npm-token-env.sh` with the same token you put in `NPM_TOKEN` to confirm `npm whoami` and `npm view` for both package names.

**Exit criterion:** No surprises in CI; token works for both package names from the same env.

---

## 6. Optional: make “version exists” check robust

- **Current:** `npm view <package>@<version>`; success → skip publish. If the registry is slow or cached, this can be wrong.
- **Options:** (a) Add a short retry/backoff for `npm view` before treating as “exists”. (b) Log the raw response when skipping. (c) In release runs, prefer “always attempt publish” and rely on 409 to skip (no pre-check). Trade-off: 409 is noisier but authoritative.
- **Recommendation:** Keep current logic; fix token first. Revisit only if we see spurious “version exists” or skips when the repo shows no packages.

---

## 7. Order of operations (summary)

1. Fix **NPM_TOKEN** (classic PAT, `write:packages`) and org Package creation (Internal/Private as needed).
2. **Run** the **“Publish Only”** workflow first (Actions → Publish Only) to isolate and fix publish without running tests.
3. **Inspect** Publish job logs; resolve 401/403 with token/org settings.
4. **Confirm** both packages under the repo’s Packages.
5. **Run** the full “Test and Publish Package” workflow (no test-only) to validate the full pipeline.
6. **Document** in this folder: “Publish verified on &lt;date&gt;; both packages visible.”

---

## References

- [PUBLISH-BACKEND-401-INVESTIGATION.md](./PUBLISH-BACKEND-401-INVESTIGATION.md) — 401 cause and token setup
- [CICD-WORKFLOW-423.md](./CICD-WORKFLOW-423.md) — Workflow layout and NPM_TOKEN note
- `.github/workflows/publish-only.yml` — Isolated publish workflow (run this first for investigation)
- `.github/workflows/test-and-publish.yml` — Full pipeline; publish job has same steps as publish-only
