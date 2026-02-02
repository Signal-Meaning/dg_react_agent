# Issue #382: Investigate Zipped Release Packages in Git Repo

**GitHub Issue**: [#382](https://github.com/Signal-Meaning/dg_react_agent/issues/382)  
**State**: OPEN  
**Author**: davidrmcgee  
**Branch**: `davidrmcgee/issue382`  
**Created**: 2026-02-01

---

## Objective

Identify why zipped packages of releases are present in the Git repository.

## Context

The repository appears to contain zipped release packages within the Git history or current state. This is unexpected for a source code repository.

## Investigation goals

- Determine the **origin** of these zipped packages (e.g. accidental commits, CI artifacts, release scripts).
- Clarify their **purpose** (intended vs unintended).
- Decide whether they should be **removed** or **excluded** from version control (e.g. via `.gitignore`, `.gitattributes`, or history cleanup).
- Document findings and any recommended changes to avoid recurrence.

---

## Suspected cause (pre-RCA)

**Hypothesis**: The release process performs a local build, and that local build (or its artifacts) is what is introducing zipped release packages into the repo. Fixing the release process to avoid committing or including those build artifacts is the expected remedy.

*RCA below confirms or refutes this theory.*

---

## Root cause analysis (RCA)

### Verdict: **Theory confirmed**

The release process **does** perform a local build and local packaging. That process is the source of release-package artifacts that ended up in the repo. Your suspicion is correct.

### Evidence

1. **Release process requires local build and package**
   - `.github/ISSUE_TEMPLATE/release-checklist.md` and `quick-release.md` both instruct: run `npm run build` and `npm run package:local` as part of "Build Package" and "Test Package".
   - `scripts/package-for-local.sh` runs `npm run build` then `npm pack`, producing a **`.tgz`** file in the repo root (e.g. `deepgram-voice-interaction-react-0.1.0.tgz`).
   - In non-interactive mode (e.g. CI) the script **keeps** the `.tgz`; in interactive mode it prompts "Do you want to clean up the .tgz file? (y/N)" and defaults to keeping it.

2. **Artifacts in Git history are .tgz (not .zip)**
   - `git log --all -- "*.tgz"` shows committed `.tgz` files: `deepgram-voice-interaction-react-0.1.0.tgz`, `deepgram-react-0.1.0.tgz` in commits such as "create new tgz, update readme", "add mode capability", and "Fixed problems with running npm run build...".
   - No `.zip` files appear in `git ls-files` or `git log`; no script in the repo creates `.zip`. "Zipped" in the issue is interpreted as **packaged release artifacts** (here: `.tgz` tarballs).

3. **Mitigation already in place**
   - `.gitignore` contains `*.tgz` (added in commits like "Add .tgz files to .gitignore to ignore build artifacts"), so new `.tgz` files are no longer tracked.
   - Commits "Remove old 0.1.0.tgz file from tracking, new 0.1.1.tgz is ignored" removed the then-tracked tarball from the index.

4. **CI does not commit**
   - `.github/workflows/test-and-publish.yml` runs `npm run build` and `npm run package:local` in CI but does not commit; artifacts stay in the runner. So the **only** way package files entered the repo was **local** runs of the release steps followed by commit.

### Conclusion

- **Origin**: Local execution of the documented release steps (`npm run build`, `npm run package:local`), which leave a `.tgz` in the repo root, followed by commit before (or without) cleanup.
- **Purpose**: Unintended. The tarballs were build/test artifacts that were committed by mistake.
- **Fix**: The process that needed fixing was "local build + package leaving artifact in tree and it getting committed." That is addressed by ignoring `*.tgz`. Optional hardening: add `*.zip` to `.gitignore`, and make the release checklist explicitly say "do not commit the .tgz produced by package:local; remove or leave it ignored."

---

## Release process fix: build in CI, not locally

### Is the build stage missing in CI?

**No.** The CI workflow (`.github/workflows/test-and-publish.yml`) already performs the build in CI:

- **test-jest** job (runs on push to main, release published, workflow_dispatch): runs `npm run build`, then `npm run package:local`, then tests package installation from the tarball. So CI builds and validates the package.
- **publish** job (runs only on `release: published` or `workflow_dispatch`, after test-jest): runs `npm run build` again, then `npm publish`. So the package that gets published is built in CI from the committed source.

When you create a GitHub release (or run the workflow manually), CI runs test-jest (build + package + tests) and, if that succeeds, publish (build + publish). The canonical build for release is therefore in CI.

### Why are builds still being staged locally?

Because the **release checklist and quick-release template** instruct maintainers to run the build and package **locally** as required steps before committing and creating the release:

- **release-checklist.md** — "Build and Package" section: "Clean Build" (`npm run clean`), "Build Package" (`npm run build`), "Validate Package" (`npm run validate`), "Test Package" (`npm run package:local`). Those are listed as checklist items before "Commit Changes" and "Create Release Branch".
- **quick-release.md** — "Version & Build" section: "Build Package" (`npm run build`), "Test Package" (`npm run package:local`) before "Documentation" and "Release".

So the reason builds are still being run locally is **documentation-driven**: the checklists were written to have people **validate** the build and package on their machine before pushing and triggering CI. That made local build/package feel required, which (1) leaves `.tgz` in the tree, (2) implies the "real" build might be local, and (3) can lead to accidentally committing artifacts. In reality, CI already does the full build and publish when you create the GitHub release — the local build/package steps are **redundant** for the purpose of publishing.

### Fix applied

- **Release checklist** and **quick-release** are updated so that **local build and package are not required**. The checklists now state that **CI builds and validates** when you create the GitHub release; maintainers only need to run tests and lint locally (e.g. `npm test`, `npm run lint`) before pushing. Optional: you may run `npm run build` or `npm run package:local` locally for quick validation, but do **not** commit any `.tgz` (they are gitignored).

---

## Progress and findings

### Current state

- **Status**: RCA complete; theory confirmed.
- **Findings**: Local release process (build + `package:local`) produced `.tgz` artifacts that were committed before `*.tgz` was added to `.gitignore`. No `.zip` in repo or scripts; "zipped" = packaged release artifacts.
- **Artifacts in repo**: Historical only. Commits touching `.tgz`: e.g. `deepgram-voice-interaction-react-0.1.0.tgz`, `deepgram-react-0.1.0.tgz` (see `git log --all -- "*.tgz"`). Current tree: none tracked (ignored by `.gitignore`).

### Origin

- Local run of release checklist: `npm run build` and `npm run package:local` (which runs `scripts/package-for-local.sh` and `npm pack`). The resulting `.tgz` was left in the repo root and committed.

### Purpose

- Unintended. The packages were build/test artifacts from validating the release; they were not meant to be versioned.

### Recommendation

- **Already done**: `*.tgz` in `.gitignore` prevents new tarballs from being tracked.
- **Optional**: Add `*.zip` to `.gitignore` for consistency. In release checklist / quick-release, add an explicit step: "Do not commit the .tgz produced by package:local; delete it or rely on .gitignore."
- **History**: No obligation to rewrite history; current state is clean. If desired, document in release docs that package artifacts must not be committed.

---

## Resolution checklist

Use this checklist to confirm the issue is resolved before closing.

- [x] **Origin identified** — Local release process: `npm run build` and `npm run package:local` produced `.tgz` in repo root; files were committed before `*.tgz` was in `.gitignore`.
- [x] **Purpose clarified** — Unintended; build/test artifacts from release validation, not meant to be versioned.
- [x] **Decision made** — Ignore package artifacts via `.gitignore` (already done for `*.tgz`). Optional: add `*.zip`; document "do not commit" in release checklist.
- [x] **Actions taken** — Release checklist and quick-release updated so local build/package are not required; CI builds from source when GitHub release is created.
- [x] **Recurrence prevented** — Checklists now state CI performs the build; local build/package optional only; `.gitignore` already prevents committing `.tgz`.
- [x] **Findings documented** — This README updated with RCA and conclusion.

---

## Related

- **`.gitignore`** — Currently ignores `*.tgz`; no `*.zip` pattern (as of 2026-02-01). See repo root `.gitignore`.
- **Release workflow** — See `.github/workflows/` and `scripts/` for release and packaging scripts that might produce zips.

---

## Document history

| Date       | Change |
|------------|--------|
| 2026-02-01 | Initial tracking document created from gh issue view 382; branch `davidrmcgee/issue382` created. |
| 2026-02-01 | Added suspected cause (local release build). RCA completed: theory **confirmed** — local `npm run build` + `package:local` produced `.tgz` that was committed before `*.tgz` in `.gitignore`; no `.zip` in repo. Optional recommendations: add `*.zip` to `.gitignore`, document "do not commit" in release checklist. |
| 2026-02-01 | Release process fix: documented that CI build stage is **not** missing (test-and-publish.yml builds in test-jest and publish jobs). Explained why builds were still staged locally: release-checklist and quick-release **required** local build/package. Updated both templates so local build/package are **not required**; CI builds from source when GitHub release is created. |
