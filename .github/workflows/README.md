# Workflows

## Test and Publish Package (`test-and-publish.yml`)

### How to test workflow changes without publishing

Use either approach:

**1. Push to `main` (runs test-jest only)**  
- Merge your workflow/action changes to `main`.  
- The workflow runs on push to `main`; only the **Jest Tests** job runs.  
- The **Publish** job does not run (it runs only on `release`, `workflow_dispatch` without test_only, or push to `release/v*`).  
- This validates the shared **prelim** action (checkout, Node, install, build) and the full test-jest pipeline.

**2. Manual run with “Test only”**  
- Go to **Actions** → **Test and Publish Package** → **Run workflow**.  
- Choose the branch that has your changes.  
- Check **“Run only test-jest (skip publish)”** (`test_only: true`).  
- Click **Run workflow**.  
- Only the **Jest Tests** job runs; **Publish** is skipped.  
- Use this to test the workflow on a feature branch without merging to `main` and without publishing.

**3. Full run (including publish)**  
- To test the **Publish** job (including the prelim step with registry config), run **workflow_dispatch** and leave **“Run only test-jest”** unchecked.  
- That will run test-jest and then publish; only do this when you intend to publish (e.g. from a release branch with a real version).

### E2E job (test-e2e) — currently suppressed

The **E2E Tests (mocks, no real APIs)** job is **disabled** in CI (`if: false`) until the backend is in its own repo. Shared folder layout and conflicting env (backend vs frontend) make CI E2E unreliable at this stage. The job definition remains in the workflow so it can be re-enabled when the backend is separated. **Publish** runs after **Jest Tests** only (no E2E gate).

### Shared prelim action

The test-jest, test-e2e (when enabled), and publish jobs use `./.github/actions/prelim` for checkout, Node setup, `npm ci`, and `npm run build` (publish also passes registry credentials for `npm publish`).
