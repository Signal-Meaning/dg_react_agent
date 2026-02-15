# Publishing and Releasing

This document describes how to publish the project’s packages and what tokens and secrets are required. It is the main reference for release and publish procedures.

---

## Overview

The repository publishes **two packages** to **GitHub Package Registry**:

| Package | Location | Registry |
|--------|----------|----------|
| **@signal-meaning/voice-agent-react** | Repository root | `https://npm.pkg.github.com` |
| **@signal-meaning/voice-agent-backend** | `packages/voice-agent-backend` | Same |

**CI publishes only these two.** The package **deepgram-voice-interaction-react** on GitHub Packages is the old name (legacy); the root was renamed to **voice-agent-react**, and the publish workflow does not publish the old name.

**CI does the build and publish.** When you create a GitHub release (or run the workflow manually), `.github/workflows/test-and-publish.yml` runs: it tests (mock), builds, validates, then publishes both packages. You do **not** run `npm publish` locally for releases; the workflow uses the **NPM_TOKEN** secret to authenticate.

- **Release flow:** Bump versions → create release docs → create `release/vX.X.X` branch → create GitHub release (tag from that branch) → CI runs and publishes.
- **Versioning:** Root and backend have **independent versions** (each has its own `package.json` version). A release can include the component only, the backend only, or both.

---

## Token required: NPM_TOKEN

Publishing to GitHub Package Registry uses a **Personal Access Token** stored as the repository secret **NPM_TOKEN**. When the token expires (or you rotate it), you **update** that secret with a new token value—you do not create a new secret; the secret name stays **NPM_TOKEN**.

### What the token must have

- **Scope (classic PAT):** **write:packages** (required for publish). **read:packages** is optional if the workflow only publishes.
- **Fine-grained PAT:** Set **Packages** to **Read and write**; token must have access to the repo and (for `@signal-meaning/*`) the org.
- **User:** Must be a member of the **Signal-Meaning** org with permission to publish packages (org settings may restrict “Allow members to publish” or “Who can create packages”).

**Note:** GitHub does not have a separate “publish” scope; **write:packages** is what allows publish (upload), delete, and restore.

### When to update the token

- The token **expires** (e.g. 90 days) — generate a new token and **update** the existing **NPM_TOKEN** secret with the new value.
- Publish fails with **401 Unauthorized** — the token may be expired or missing **write:packages**; update the secret with a new token per the steps below.

### Updating NPM_TOKEN (replace the secret’s value)

You do **not** create a new repo secret each time. The secret **NPM_TOKEN** already exists; you **update** it with a new token value (e.g. after generating a new PAT when the old one expires).

1. **Get a new token value** (same scopes, new expiration):
   - Go to **https://github.com/settings/tokens** (or **Profile picture** → **Settings** → scroll to **Developer settings** → **Personal access tokens** → **Tokens (classic)**).
   - **Preferred:** Click your existing **NPM_TOKEN** in the list. On the edit page, click **Regenerate token**. You keep the same note and scopes and can set a new expiration; copy the new token value (scripts/apps using the old value will need the updated secret).
   - **Alternatively:** Click **Generate new token (classic)** and set note (e.g. `NPM_TOKEN for dg_react_agent publish`), expiration, and scopes **write:packages** (and **read:packages** if needed), **repo** if required by org.
   - **Generate token** → **copy the token immediately** (you won’t see it again).

2. **Update the repo secret** (replace the existing value):
   - Repo **github.com/Signal-Meaning/dg_react_agent** → **Settings** → **Secrets and variables** → **Actions**.
   - Under **Repository secrets**, find **NPM_TOKEN** and click it (or **Update** if shown).
   - Paste the **new token** as the value and save. The next workflow run will use this value.

3. **Trigger a publish** (optional): Run **Test and Publish Package** to confirm publish works with the updated token.

### First-time setup (when NPM_TOKEN does not exist)

If the repository has no **NPM_TOKEN** secret yet (e.g. first publish from this repo):

1. Generate a classic token with **write:packages** (and **read:packages** if needed) per the steps under “Updating NPM_TOKEN” above.
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
3. **Name:** `NPM_TOKEN`. **Value:** paste the token. **Add secret.**

### Where NPM_TOKEN is used in the project

| Location | Use |
|----------|-----|
| **Repository secret** | **Settings → Secrets and variables → Actions** → secret name **NPM_TOKEN**. |
| **`.github/workflows/test-and-publish.yml`** | Publish job: writes `//npm.pkg.github.com/:_authToken=${{ secrets.NPM_TOKEN }}` into `~/.npmrc` or `.npmrc` so `npm publish` authenticates to GitHub Package Registry. |
| **`.github/workflows/debug-auth.yml`** | Optional debug workflow; also uses `secrets.NPM_TOKEN` for registry auth. |

No other copy of the token should be committed; the workflow injects it at run time. **If you never run `npm publish` locally** (releases are done via CI), you do **not** need the token on your dev machine—having it only in GitHub as the repo secret is enough. You only need it locally if you do a local publish (e.g. CI fallback) or if you install private `@signal-meaning` packages from GitHub Package Registry and auth is required.

### If publish still fails with 401

- Confirm the token has **write:packages** and the user can publish in the org.
- If the org blocks classic tokens, an org owner may need to allow classic tokens for Packages or create the token and add the secret.

Detailed investigation notes (including CI log examples and script-fix notes) are in **docs/issues/ISSUE-425/PUBLISH-BACKEND-401-INVESTIGATION.md**.

---

## Release process (summary)

1. **Pre-release:** Tests and lint passing; version bumps and release docs in `docs/releases/vX.X.X/` (see release checklist template).
2. **Branch:** Create `release/vX.X.X` from the branch that has the release changes; push.
3. **NPM_TOKEN:** If expired or missing, update the **NPM_TOKEN** secret per the section above.
4. **GitHub release:** Create a new release with tag **vX.X.X** (from branch `release/vX.X.X`). This triggers the Test and Publish workflow.
5. **CI:** Workflow runs tests, build, then publish for root and (if version exists) backend. Monitor the run until it succeeds.
6. **Post-release:** Open a PR **release/vX.X.X** → **main** and merge via the GitHub UI (do not push directly to `main`).

Full step-by-step checklist: **.github/ISSUE_TEMPLATE/release-checklist.md** (use for each release).

---

## References

- **Release checklist template:** `.github/ISSUE_TEMPLATE/release-checklist.md`
- **Workflow:** `.github/workflows/test-and-publish.yml`
- **Backend install/registry:** `packages/voice-agent-backend/README.md`
- **401 / token investigation (issue):** `docs/issues/ISSUE-425/PUBLISH-BACKEND-401-INVESTIGATION.md`
- **CI/CD workflow design (issue):** `docs/issues/ISSUE-425/CICD-WORKFLOW-423.md`
- **Release doc standards:** `docs/releases/README.md`
