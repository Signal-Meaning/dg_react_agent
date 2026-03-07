# Test and Publish Workflow Failures — Resolution

**Workflow:** `.github/workflows/test-and-publish.yml` (Test and Publish Package)  
**Branch:** `release/v0.9.8`  
**Purpose:** Run Jest (mock), build, publish to GitHub Package Registry, then create GitHub release.

---

## CI/CD runs on release branches only — never on main

**The Test and Publish workflow must run on release branches only.** Do **not** run it against `main`.

- **Correct:** Trigger the workflow from a branch named `release/vX.X.X` (e.g. `release/v0.9.8`). When using **Run workflow**, choose **Branch: release/vX.X.X**. CLI: `gh workflow run "Test and Publish Package" --ref release/v0.9.8`.
- **Wrong:** Running the workflow with **Branch: main** (or leaving branch defaulting to main). That would build and potentially publish from main, which this project does not allow.
- **Policy:** See [PUBLISHING-AND-RELEASING.md](../docs/PUBLISHING-AND-RELEASING.md): release flow is create `release/vX.X.X` → create GitHub release (tag from that branch) → CI runs and publishes. CI is intended to run in that context only.

---

## 1. Capture the failure

1. Open **GitHub → Actions** → select the failed **Test and Publish Package** run.
2. Note which **job** failed: `test-jest` or `publish`.
3. Open the failed job and the **failed step** (red X).
4. Copy the **error message** and the last 30–50 lines of the log into the section below.

### Actual failure (paste here)

**Run 22725384431** (branch: `release/v0.9.8`, workflow_dispatch): [View on GitHub](https://github.com/Signal-Meaning/dg_react_agent/actions/runs/22725384431)

- **Job:** Jest Tests (Unit & Integration)  
- **Failed step:** Run npm audit (fail on high/critical)  
- **Cause:** `npm audit --audit-level=high` reported 10 vulnerabilities (4 low, 6 high), e.g. @tootallnate/once, minimatch, rollup, serialize-javascript. **@tootallnate/once** is a legitimate, widely-used package (~44M weekly downloads) that creates a Promise for a single EventEmitter event; we pull it in transitively (jest-environment-jsdom → jsdom → http-proxy-agent). The advisory (GHSA-vpq2-c234-7xj6, "Incorrect Control Flow Scoping") is fixed in 3.0.1; we had 2.0.0. Fix by upgrading the chain or using overrides; the package itself is safe (not malicious).  
- **Branch for this run was correct** (release/v0.9.8); the failure was audit, not checkout.  
- **Fix:** Address high/critical audit issues on the release branch (e.g. `npm audit fix` or overrides as per policy), then re-run the workflow **from the release branch** (never from main).

```
# Example log tail (run 22725384431):
# 10 vulnerabilities (4 low, 6 high)
# npm audit --audit-level=high → exit code 1
```

---

## 2. Common causes and fixes

### test-jest job

| Step | What fails | Fix |
|------|------------|-----|
| **Checkout** | Wrong ref / branch (e.g. ran against main) | **CI must run on release branches only, never on main.** When triggering manually: Actions → Run workflow → **Branch: release/v0.9.8** (or the relevant release branch). CLI: `gh workflow run "Test and Publish Package" --ref release/v0.9.8`. Re-run from the Actions UI and choose the release branch, not main. |
| **Prelim (Node, install, build)** | Uses `Signal-Meaning/dg_react_agent/.github/actions/prelim@main` | Ensure `main` has the prelim action and it succeeds (Node, `npm ci`, `npm run build`). If the action was recently changed, merge to `main` or point the workflow at the release branch for the action. |
| **npm audit** | High/critical vulnerabilities | Run `npm audit --audit-level=high` locally; fix or allow with `npm audit fix` / overrides as per policy. **Prerequisite:** Pass audit in Pre-Release (see [RELEASE-CHECKLIST.md](../docs/issues/ISSUE-489/RELEASE-CHECKLIST.md)) before triggering the workflow. |
| **Run linting** | `npm run lint` fails | Fix lint errors in the branch and push. |
| **Run Jest tests (mock only)** | `npm run test:mock` fails | Fix failing tests; ensure `CI=true RUN_REAL_API_TESTS=false npm run test:mock` passes locally. |
| **Test package packaging** | `npm run package:local` or missing `*.tgz` | Fix build or packaging script; ensure `package:local` produces a tarball in repo root. |
| **Test package installation from tarball** | Install or import from `*.tgz` fails | Fix package exports or dependencies so the tarball installs and the entry point is importable. |
| **Validate voice-agent-backend package** | `npm pack --dry-run` in backend | Fix backend `package.json` or files included in pack. |

### publish job

| Step | What fails | Fix |
|------|------------|-----|
| **Checkout** | Builds from wrong ref (e.g. main) | **Never run publish from main.** Re-run workflow with **Branch: release/v0.9.8** (or the relevant release branch) selected. Publish uses `inputs.branch` or `github.ref` for checkout. |
| **Prelim** | Same as test-jest; also configures npm registry with `NPM_TOKEN` | Resolve prelim/install/build as above; ensure `NPM_TOKEN` secret is set (needed for publish). |
| **Verify authentication** | `npm whoami` fails (401) | **NPM_TOKEN** invalid or expired. See [PUBLISHING-AND-RELEASING.md](../docs/PUBLISHING-AND-RELEASING.md): create/regenerate a PAT with `write:packages`, update the **NPM_TOKEN** repo secret in Settings → Secrets and variables → Actions. |
| **Check if version already exists** | Version already published | Either bump version and push, or re-run with **Force publish** (workflow input) if intentional. |
| **Publish** (root or backend) | 401/403, or prepublishOnly script fails | Fix NPM_TOKEN (see above). If `prepublishOnly` fails, fix the script or temporary disable only if documented. |

---

## 3. Quick checks before re-running

- [ ] **Branch for the run is a release branch (e.g. release/v0.9.8), not main.** Actions UI: when running the workflow, choose **Branch: release/vX.X.X**. Never run Test and Publish against main.
- [ ] **NPM_TOKEN** exists under Settings → Secrets and variables → Actions and has **write:packages** (and org access if required).
- [ ] Locally on the release branch: `npm run lint`, `npm run test:mock`, `npm run build`, `npm run package:local` all succeed.
- [ ] No high/critical audit: `npm audit --audit-level=high` (or address any reported issues before re-running).

---

## 4. Re-run and fallback

- **Re-run failed jobs:** Actions → open the failed run → "Re-run all jobs" or "Re-run failed jobs". Ensure the run is for a release branch, not main.
- **Re-run from correct branch:** Actions → Test and Publish Package → "Run workflow" → select **Branch: release/v0.9.8** (or the relevant release branch). **Do not select main.**
- **Fallback (dev publish):** If CI cannot be fixed quickly, from repo root on the release branch (e.g. `release/v0.9.8`) with `NPM_TOKEN` in env or `.npmrc`: `npm publish`. Then tag and create the GitHub release manually. See [RELEASE-CHECKLIST.md](../docs/issues/ISSUE-489/RELEASE-CHECKLIST.md) and [PUBLISHING-AND-RELEASING.md](../docs/PUBLISHING-AND-RELEASING.md).

---

## References

- [RELEASE-CHECKLIST.md](../docs/issues/ISSUE-489/RELEASE-CHECKLIST.md) — Issue #489 release steps
- [PUBLISHING-AND-RELEASING.md](../docs/PUBLISHING-AND-RELEASING.md) — NPM_TOKEN, publish flow
- [workflows/test-and-publish.yml](workflows/test-and-publish.yml) — workflow source
- [workflows/README.md](workflows/README.md) — how to run and test the workflow
