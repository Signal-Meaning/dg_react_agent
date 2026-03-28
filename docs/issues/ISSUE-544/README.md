# Issue #544 — Release v0.10.5 (Epic #542)

**GitHub:** [#544 — Release v0.10.5: Patch — Epic #542 (@signal-meaning/voice-agent-react + voice-agent-backend)](https://github.com/Signal-Meaning/dg_react_agent/issues/544)

**Labels:** release, patch, priority: high

**State:** Published to GitHub Packages (**v0.10.5** / backend **0.2.10**); **open** until `release/v0.10.5` is merged to `main` and Issue #544 is closed.

---

## What this issue is

Issue #544 is the **release driver** for a **patch** of the published pair **after** `@signal-meaning/voice-agent-react` **v0.10.4** and `@signal-meaning/voice-agent-backend` **0.2.9**. It ships **[Epic #542](https://github.com/Signal-Meaning/dg_react_agent/issues/542)** (Voice Commerce OpenAI proxy defect register, §1–§6), already **merged to `main`** via **[PR #543](https://github.com/Signal-Meaning/dg_react_agent/pull/543)**.

**Target published versions (set on the release branch in `package.json` before publish):**

| Package | Version |
|---------|---------|
| `@signal-meaning/voice-agent-react` | **0.10.5** (git tag `v0.10.5`) |
| `@signal-meaning/voice-agent-backend` | **0.2.10** |

---

## Local docs

| Doc | Purpose |
|-----|---------|
| [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) | Repo-local release and qualification steps with fixed versions and commands. |
| [SCOPE.md](./SCOPE.md) | What is in this release (surfaces, tests, docs). |
| [TRACKING.md](./TRACKING.md) | PR links and verification log as you run checks. |
| [TDD-PLAN-E2E-EIGHT-FAILURES.md](./TDD-PLAN-E2E-EIGHT-FAILURES.md) | TDD plan for the eight failing proxy E2E tests blocking full suite green. |

The **full step-by-step checklist** (same structure as the release template) lives in the **body of GitHub Issue #544**. Use that issue for checkbox tracking; use this folder for stable links and copy-paste commands from the repo.

---

## Related references

- [Epic #542 README](../ISSUE-542/README.md) — defect register, child issues, bundles.
- [.github/ISSUE_TEMPLATE/release-checklist.md](../../../.github/ISSUE_TEMPLATE/release-checklist.md) — canonical release process template.
- [docs/PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md) — registry, tokens, workflow.
- [.cursorrules](../../../.cursorrules) — real-API qualification for proxy changes; E2E from `test-app`.

This release is **proxy- and protocol-heavy**. Qualify with **real OpenAI** where Issue #544 and `.cursorrules` require it; mock-only CI is not enough to claim upstream-qualified behavior.
