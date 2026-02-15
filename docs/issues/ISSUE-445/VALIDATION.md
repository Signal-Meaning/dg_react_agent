# Validating packaging decisions (Issue #445)

**Parent:** [README.md](./README.md) · **Policy:** [docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md)

---

## Goal

We need to **validate that our packaging decisions are correct** and stay correct over time. Concretely: (1) **automated tests** that assert each published package ships the right things and not the wrong things; (2) a **single policy** that defines the rules so tests and humans share the same source of truth; (3) **CI and pre-publish** runs so regressions (e.g. re-adding `scripts` to the React package) are caught before publish.

---

## Rationale (why we validate this way)

Packaging decisions are easy to get wrong and easy to regress: someone adds `scripts` back to the React package for convenience, or a new script is placed at repo root and later ends up in the wrong package's `files`. We don't want to rely only on human checklists or memory. So we:

- **Encode the rules in a single policy** ([PACKAGING-POLICY.md](../../PACKAGING-POLICY.md)) so there is one place to read "what each package must / must not ship." The allocation tables in [README.md](./README.md) are the full audit; the policy is the executable summary.
- **Turn the rules into automated tests** (packaging contract tests in `tests/packaging/`). The tests assert that `npm pack` output and package layout match the policy. If someone changes `files` or moves a script, the tests fail until the change is either correct (and the policy updated if needed) or reverted.
- **Run the tests in CI and before publish** so regressions are caught before they ship. The same tests are written first in the TDD plan ([TDD-PLAN.md](./TDD-PLAN.md)) to define the desired outcome, then kept as the ongoing validation.

This way, "our packaging decisions" are not just documented—they are **enforced**. New or moved scripts get validated against the same rules; we extend the tests when we extend the allocation (e.g. adding a forbidden path for the React package).

---

## What we validate (summary)

| Decision | How we validate |
|----------|-----------------|
| Backends can run the OpenAI proxy without the React package | **Test:** Resolve backend package; assert proxy script path exists; optionally spawn and assert client can connect. (TDD-PLAN Phase 1.1 → 2.) |
| React package does not ship the OpenAI proxy (or any backend/maintainer-only scripts) | **Test:** `npm pack --dry-run` for root package; assert no `scripts/openai-proxy/` (and after fix, no `scripts/` or only allowlist). (TDD-PLAN Phase 1.2 → 4.) |
| test-app backend spawns proxy from backend package path | **Test:** Assert spawn cwd/path is derived from backend package resolution, not React package. (TDD-PLAN Phase 1.3 → 3.) |
| Backend package ships what backends need | **Test:** Assert backend package `files` includes `src/`, `README.md`, and (after move) proxy path; no React/test-app-only paths. |
| Other scripts stay out of React package | **Policy:** React package `files` must not include `scripts/` (or only an explicit allowlist). **Test:** Same as above—assert packed file list has no forbidden paths. |
| Allocation tables stay accurate | **Process:** When adding or moving a script, update [README.md](./README.md) allocation tables and run packaging tests. Policy doc [PACKAGING-POLICY.md](../../PACKAGING-POLICY.md) summarizes rules. |

---

## Packaging contract tests (where and what)

**Suggested location:** `tests/packaging/` (new directory).

| Test file | Asserts |
|-----------|---------|
| `react-package-files.test.js` (or `.ts`) | Root package: `npm pack --dry-run` (or `files` + default includes) does not contain `scripts/openai-proxy/`. After ISSUE-445: does not contain `scripts/` (or matches allowlist). Optionally: contains `dist/`, `src/`, `README.md`. |
| `backend-package-files.test.js` | Backend package: `files` includes `src/`, `README.md`. After ISSUE-445: includes proxy path (e.g. `scripts/openai-proxy/run.ts`). Does not include React or test-app-only paths. |
| `openai-proxy-from-backend-package.test.js` | Resolve `@signal-meaning/voice-agent-backend` (from repo path or require); assert proxy entry script exists; optionally spawn proxy and assert WebSocket connection. |
| `test-app-backend-proxy-spawn.test.js` (or in `tests/integration/`) | When test-app backend (or a minimal attachVoiceAgentUpgrade caller) starts OpenAI proxy, spawn options use backend package path, not React package. |

Run all: `npm test -- tests/packaging` (and include in CI).

---

## Extending validation to other decisions

The **allocation tables** in [README.md](./README.md) group every script by purpose and consumer. To validate "other packaging decisions" beyond the proxy:

1. **Turn rules into assertions**  
   For each "must not be in package X" row, add an assertion in the right test file. Examples:
   - React package must not ship: `scripts/` (entire dir after ISSUE-445), or at minimum `scripts/openai-proxy/`, `scripts/validate-publish-auth.js`, etc.
   - Backend package must not ship: any path under `test-app/`, or root `scripts/generate-test-audio.js`.

2. **Allowlists if needed**  
   If we ever want the React package to ship a small subset of scripts (e.g. none today; later maybe a single "compat" script), define an **allowlist** in one place (e.g. a constant in the test file or a small `packaging-rules.js`), and assert the packed file list only contains scripts on that allowlist.

3. **New packages**  
   If we add a package (e.g. `@signal-meaning/openai-translation-proxy`), add a new test file and policy section: what it must include, must not include, and a test that runs `npm pack --dry-run` for that package.

4. **Docs**  
   Keep [PACKAGING-POLICY.md](../../PACKAGING-POLICY.md) in sync: when you add a test for a new rule, add the rule to the policy so the doc remains the single source of truth.

---

## When to run

- **Locally:** `npm test -- tests/packaging` before committing changes to `package.json` `files` or to script locations.
- **CI:** Include `tests/packaging` in the test job (same as other Jest tests).
- **Pre-publish:** Release checklist should require packaging tests to pass; optionally add `validate:packaging` script that runs only these tests for a fast check.

---

## Summary

| Question | Answer |
|----------|--------|
| How do we validate packaging? | Packaging contract tests in `tests/packaging/` that assert each package's published contents and that backends can run the proxy from the backend package only. |
| Where are the rules? | [docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md) (testable rules); [README.md](./README.md) (full allocation audit). |
| How do we keep other decisions correct? | Encode every "must / must not" from the policy and allocation into tests; run them in CI; update policy and allocation when adding or moving scripts. |

---

## Relationship to other ISSUE-445 docs

| Doc | Role |
|-----|------|
| [README.md](./README.md) | Issue scope, approach (fix + allocation + policy + validation + TDD), allocation tables, acceptance criteria. |
| [TDD-PLAN.md](./TDD-PLAN.md) | RED → GREEN → REFACTOR; packaging contract tests are written first, then implementation; Phase 5.3 ties policy and validation into CI. |
| [VALIDATION.md](./VALIDATION.md) (this file) | How we validate (tests, CI, pre-publish); how to extend to other scripts; rationale for policy + tests. |
| [docs/PACKAGING-POLICY.md](../../PACKAGING-POLICY.md) | Repo-wide single source of truth: testable rules per package; how validation runs. |
