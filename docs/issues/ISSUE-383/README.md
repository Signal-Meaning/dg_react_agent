# Issue #383 – Quick Release (Post–#381)

**Branch**: `davidrmcgee/issue383`  
**GitHub**: [Issue #383](https://github.com/Signal-Meaning/dg_react_agent/issues/383)

## Ticket summary (from `gh issue view 383`)

- **Title**: Quick Release v0.7.11: Patch Release (Issue #381 – customer defect resolved)
- **State**: OPEN
- **Labels**: patch, priority:medium, release
- **Context**: Release delivers the **Issue #381** fix (OpenAI Realtime proxy): backend proxy, unit/integration/E2E validation, greeting injection, and documentation. Acceptance criteria for #381 are complete.

## Commits since last release (v0.7.10)

All commits from `v0.7.10..HEAD` to include in this release:

```
7f34faf Merge pull request #385 from Signal-Meaning/davidrmcgee/issue382
8c58ab6 fix(release): build in CI only; remove required local build/package (fixes #382)
0ff0321 Merge pull request #384 from Signal-Meaning/issue-380-openai-inject-upstream-close
1e3cb78 chore(issue-381): instructions E2E, release body, E2E run list updates
c365ac3 docs(ISSUE-381): E2E priority list, Deepgram renames, missing OpenAI tests, API key safety
36f305c feat(381): greeting proxy + E2E; complete E2E priority list and test plan
8c5ad5b docs(381): RUN-OPENAI-PROXY, test-app docs for proxy and improvements
36dcbca Issue #381: Phase 4 E2E pass, API gap integration tests, Phase 5 doc prep
7d952d2 docs: E2E priority list remaining tests, pre-started server, ignore log
af57364 fix: HTTPS/env and proxy startup; E2E docs and priority run list
e305ed7 OpenAI proxy: map function_call_arguments.done → ConversationText (Issue #381)
cac7ca1 OpenAI proxy: adopt OpenTelemetry logging (Issue #381)
1326112 OpenAI proxy: binary audio input, E2E basic audio enabled (Issue #381)
1ad1715 Default test-app proxy endpoint to OpenAI proxy
b3d7ba5 docs: update release status - v0.7.10 release complete and merged to main
7ef6bf9 Merge branch 'release/v0.7.10'
9550074 docs: update release checklist - tag verified, GitHub release complete, merge to main
421f59c docs: update release checklist - CI workflow completed, package published, tag created
eab760a fix: add missing stopKeepalive and startKeepalive methods to mock in voice-agent-api-validation.test.tsx
e3f2f6a fix: add missing stopKeepalive and startKeepalive methods to mock in lazy-initialization.test.js
5709ca6 docs: update release checklist - GitHub release created, CI workflow in progress
7d107e3 Merge pull request #376 from Signal-Meaning:davidrmcgee/issue375
```

## Version recommendation

- **At least minor**: Yes. New features since v0.7.10 include:
  - OpenAI Realtime proxy (scripts/openai-proxy, greeting injection, binary audio, OpenTelemetry, function_call_arguments mapping).
  - Test-app default proxy endpoint to OpenAI proxy; E2E in proxy mode as primary.
  - E2E priority list, test plan, and docs (RUN-OPENAI-PROXY, etc.).
- **Could it be more than minor?**
  - **Minor (0.8.0)** is appropriate: new features, no intentional breaking API changes.
  - **Major (1.0.0)** would be only if we introduced breaking public API or behavior; not indicated by these commits.
- **Patch (0.7.11)** is what the ticket title uses for a “quick” customer fix; semver-strict, the scope is better reflected as **minor → v0.8.0**. Choose:
  - **v0.7.11** – ship fast as patch (issue as written).
  - **v0.8.0** – reflect new features and scope (recommended if semver is strict).

See [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) for the full release checklist (version-agnostic; substitute 0.7.11 or 0.8.0 as decided).
