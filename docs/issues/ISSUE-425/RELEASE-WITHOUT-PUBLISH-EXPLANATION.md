# Why a Release Can Appear Without Packages Being Published

**Context:** The release (e.g. v0.8.2) shows up on GitHub Releases, but the npm packages (`@signal-meaning/voice-agent-react`, `@signal-meaning/voice-agent-backend`) were not published to GitHub Package Registry (or only one was, or publish failed).

---

## 1. Publish job only runs for certain triggers

In `.github/workflows/test-and-publish.yml`, the **Publish** job runs only when:

```yaml
if: success() && (
  github.event_name == 'release' ||
  (github.event_name == 'workflow_dispatch' && inputs.test_only != true) ||
  (github.event_name == 'push' && startsWith(github.ref, 'refs/heads/release/v'))
)
```

So:

- **Push to `main`** → workflow runs (test-jest) but **Publish is skipped**. Only tests run.
- **Push to `release/v*`** → test-jest runs, then Publish runs, then “Create GitHub Release” runs (workflow creates the release).
- **Release published in UI** → workflow runs with `event_name == 'release'`, so Publish runs.
- **workflow_dispatch** (without “test only”) → Publish runs.

If the only trigger was a **push to `main`** (e.g. after merging a release branch), the Release page would **not** be created by the workflow. So a “release that happened without publishing” in that case means: **the Release was created manually** (or by some other process), and the workflow run that executed (on push to main) never ran the Publish job, so packages were never published by that run.

---

## 2. Creating the Release in the UI first (“release: published”)

If someone **creates and publishes a GitHub Release in the UI** (e.g. “Draft new release” → choose tag `v0.8.2` → “Publish release”):

- The workflow runs with **`event_name == 'release'`** and **`types: [published]`**.
- The **Publish** job **does** run.
- Checkout uses: `ref: ${{ inputs.branch || github.ref }}`. For the **release** event, **`github.ref` is the repository’s default branch** (e.g. `refs/heads/main`), **not** the release tag.

So the workflow checks out **main**, builds **main**, and publishes whatever **version is in `package.json` on main**. That can cause:

- **Wrong version:** The Release is for v0.8.2, but main might still be 0.8.1 (release not merged yet) → workflow would try to publish 0.8.1, and the Release in the UI would not match what was published.
- **Publish failure:** If `main` does have 0.8.2 and the workflow runs, publish can still **fail** (e.g. 401 Unauthorized for `NPM_TOKEN` or for the backend package). The Release page already exists (created in the UI), but packages never made it to the registry → “release happened without publishing.”

So: **creating the Release in the UI first** can lead to “release exists, packages not published” either because the workflow built the wrong ref or because publish failed.

---

## 3. “Version already exists” → skip publish, release still created

The publish step contains:

```yaml
if [ "${{ steps.check_version.outputs.version_exists }}" == "true" ] && [ "$FORCE_PUBLISH" != "true" ]; then
  echo "⚠️ Skipping publish; continuing so Create GitHub Release can run."
  exit 0
fi
```

So if that version **already exists** in the registry (e.g. from a previous run or manual publish) and **force** is not set:

- **Publish is skipped** (exit 0).
- Later steps still run, including **“Create GitHub Release”** when the trigger is **push to `release/v*`** or **workflow_dispatch**.

Result: the run creates (or updates) the **Release** in the UI but does **not** push any new package version. So “release happened without publishing” can mean “this run created the release but did not publish packages because version already existed.”

---

## 4. Publish failed but step reported success (historical)

See `PUBLISH-BACKEND-401-INVESTIGATION.md`: there was a bug where the backend publish could **fail with 401** but the step used `npm publish 2>&1 | tee ...` and the **exit code was from `tee`** (0), so the job continued and “Create GitHub Release” ran. That was fixed by using `${PIPESTATUS[0]}` so the step fails when `npm publish` fails. If v0.8.2 was released before that fix, a failed publish could have been reported as success and the release created → “release happened without publishing.”

---

## 5. Recommended flow so release and publish stay in sync

1. **Do not create the GitHub Release in the UI first.**  
   Let the workflow create it after a successful publish.

2. **Use the release-branch flow:**
   - Create and push **`release/vX.X.X`** with version bumps and release docs.
   - Trigger the workflow by **pushing to `release/vX.X.X`** (or run **workflow_dispatch** from that branch with the correct ref).
   - Workflow: test-jest → publish both packages → **then** “Create GitHub Release” (tag + Release page). So the Release only appears after a successful publish.

3. **If you must trigger from “Publish release” in the UI:**  
   The workflow should **checkout the release tag** when `event_name == 'release'`, e.g. use the release tag for checkout so the built and published code matches the Release (see fix below).

---

## 6. Workflow fix: checkout release tag when trigger is “release”

When the workflow is triggered by **release: published**, checkout should use the **release tag**, not the default branch.

In **Checkout** and **Prelim** (and any step that needs the release ref), use:

- `ref: ${{ github.event.release.tag_name || inputs.branch || github.ref }}`

so that for a release event the job checks out the tag that was published (e.g. `v0.8.2`), and the version in `package.json` matches the Release.

This is applied in the workflow in the same directory so that “release happened without publishing” due to wrong ref is avoided when the trigger is “release: published.”
