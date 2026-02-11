# Backend publish 401 investigation (CI log)

## What the CI log shows

From run **21890320390** (release/v0.8.0, workflow_dispatch):

### 1. Backend publish step actually fails with **401 Unauthorized**

```
Publish voice-agent-backend to GitHub Package Registry:
  ...
  npm notice Publishing to https://npm.pkg.github.com/ with tag latest and default access
  npm error code E401
  npm error 401 Unauthorized - PUT https://npm.pkg.github.com/@signal-meaning%2fvoice-agent-backend - unauthenticated: User cannot be authenticated with the token provided.
```

So **npm publish** for `@signal-meaning/voice-agent-backend` is rejected by GitHub Packages: the token used in CI (`NPM_TOKEN`) is not allowed to publish this package (new package create or write).

### 2. Step still reports success (script bug)

The step then prints:

```
✅ voice-agent-backend published successfully
```

So the job does not fail even though publish failed. Cause: the run script uses

```bash
npm publish 2>&1 | tee /tmp/npm-publish-backend.log || { ... exit $EXIT_CODE }
```

In a pipeline, the exit status is that of the **last** command (`tee`). When `npm publish` fails, `tee` still exits 0, so the `|| { ... }` block never runs and the script continues and prints success. The workflow step should check `${PIPESTATUS[0]}` after the pipeline and exit non-zero when npm publish failed.

### 3. Verify step then fails with 404

The next step "Verify voice-agent-backend installation" runs `npm install @signal-meaning/voice-agent-backend` and gets **404 Not Found** (package was never created because publish failed). That step has `continue-on-error: true`, so the job still completes “successfully”.

## Root cause

- **401:** The `NPM_TOKEN` secret used in the publish job does not have permission to publish (or create) the package `@signal-meaning/voice-agent-backend` on GitHub Package Registry.

## What to add to the token

GitHub does **not** have a separate “publish” scope. For GitHub Packages you use:

- **`write:packages`** — allows **publish** (upload), delete, and restore packages. This is what you need for “new package create or write.”
- **`read:packages`** — allows download/install from GitHub Packages (optional for CI if you only publish).

**Classic PAT:** When creating the token, under “Scopes” check **write:packages** (and **read:packages** if the workflow also installs from GPR).

**Fine-grained PAT:** Under “Repository permissions” or “Organization permissions”, set **Packages** to **Read and write**. The token must have access to the repo (and the org, for org-scoped packages like `@signal-meaning/voice-agent-backend`).

The token’s user must be a member of the `Signal-Meaning` org with permission to publish packages (org settings may restrict “Allow members to publish” or “Who can create packages”).

## Fixes

1. **Token (required for publish to succeed)**  
   - Add **write:packages** (classic) or **Packages: Read and write** (fine-grained) to the token stored in `NPM_TOKEN`.  
   - Re-run the workflow after updating the secret.

2. **CI script (so the job fails when publish fails)**  
   - After `npm publish 2>&1 | tee ...`, check `${PIPESTATUS[0]}` and exit non-zero if it is not 0, and only then print “published successfully”.  
   - This does not fix the 401 but ensures the workflow correctly fails when the backend publish fails.

---

## Walkthrough: create token and add secret (website)

**There is no "create package" or "create backend registry" page on GitHub.** The package `@signal-meaning/voice-agent-backend` is created automatically the first time a successful `npm publish` runs. All you do on the website is create a token that can publish, then store it as the repo secret.

Use a **classic** Personal Access Token (fine-grained tokens do not support GitHub Packages yet).

### 1. Create a classic token with `write:packages`

1. Go to **github.com** and log in (as a user who is in the `Signal-Meaning` org and can publish packages).
2. Click your **profile picture** (top right) → **Settings**.
3. In the left sidebar, click **Developer settings** (bottom).
4. In the left sidebar, under **Personal access tokens**, click **Tokens (classic)**.
5. Click **Generate new token** → **Generate new token (classic)**.
6. **Note:** e.g. `NPM_TOKEN for dg_react_agent publish`.
7. **Expiration:** choose what you use (e.g. 90 days or No expiration if allowed).
8. Under **Scopes**, check **write:packages** (and **read:packages** if CI also installs from GitHub Packages).
9. If the org requires it, you may need **repo** as well (for repo access).
10. Click **Generate token**.
11. **Copy the token immediately** (you won't see it again).

### 2. Add the token as the repo secret

1. Go to the repo: **github.com/Signal-Meaning/dg_react_agent**.
2. Click **Settings** → **Secrets and variables** → **Actions**.
3. Under **Repository secrets**, click **New repository secret**.
4. **Name:** `NPM_TOKEN`.
5. **Value:** paste the token you copied.
6. Click **Add secret**.

### 3. Trigger a publish

Run the "Test and Publish Package" workflow (e.g. **Actions** → **Test and Publish Package** → **Run workflow**, with "Run only test-jest" **unchecked**). The first successful run that publishes the backend will create the package on GitHub Packages; it will then show under the repo's **Packages** (and under the org).

### If the org blocks classic tokens

If **Signal-Meaning** restricts classic tokens, an org owner may need to allow classic tokens for Packages, or create the token themselves and give you the secret value to store in the repo (or add the secret for you).

---

## References

- Workflow: `.github/workflows/test-and-publish.yml`  
- Step: “Publish voice-agent-backend to GitHub Package Registry”  
- Run: https://github.com/Signal-Meaning/dg_react_agent/actions/runs/21890320390
