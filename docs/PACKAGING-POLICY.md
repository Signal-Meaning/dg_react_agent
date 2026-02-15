# Packaging policy

This document defines how we package and validate **@signal-meaning/voice-agent-react** and **@signal-meaning/voice-agent-backend**. It is the single source of truth for "what belongs where" and how we check that packaging decisions are correct. See also **docs/issues/ISSUE-445/** for the defect that drove this policy and the script allocation audit.

---

## Principles

1. **Frontend-only in the React package**  
   The React package ships only what React apps need: component code, types, and browser-side utilities. No server-side or proxy scripts.

2. **Backend tooling in backend (or dedicated) packages**  
   Scripts that run in Node (proxies, CLIs, server helpers) live in a package that backends install. Consumers must never need to resolve the React package to run backend tooling.

3. **Maintainer-only scripts stay at repo root**  
   Test-infra, build support, publish/release, and test-execution scripts stay at repo root and are **not** published in any package's `files`.

4. **Issue docs are internal only; do not ship to customers**  
   `docs/issues/` is for internal issue tracking, release checklists, and TDD plans. We **do not** update issue docs as we ship, and we **do not** release them to customers. The React package's `.npmignore` excludes `docs/issues/` so it is never included in the published tarball. If a doc is needed in a permanent or customer-facing way, move it **out of** `docs/issues/` into an appropriate permanent location (e.g. `docs/`, `docs/BACKEND-PROXY/`, `docs/releases/`, or `docs/development/`).

---

## Package rules (testable)

### @signal-meaning/voice-agent-react (root package.json)

| Rule | Assertion |
|------|-----------|
| **Must include** | `dist/`, `src/`, types (e.g. `dist/index.d.ts`), `README.md`. Optional for consumers: `tests/`, `docs/`, `DEVELOPMENT.md` (product decision). |
| **Must NOT include** | Any path under `scripts/openai-proxy/` (backend proxy). After ISSUE-445: **Must NOT include** `scripts/` at all (or use an explicit allowlist so no backend or maintainer-only script is shipped). **Must NOT include** `docs/issues/` (internal/maintainer only; excluded via `.npmignore`). |
| **Must NOT** | Require or document that backends depend on this package to run the OpenAI proxy or any other server-side tool. |
| **Consumer** | React applications only. Backends must not need to install or resolve this package for proxy or server behavior. |

Validation: run **packaging contract tests** (see below) that assert `npm pack --dry-run` (or the `files` array) does not contain forbidden paths and, if desired, does contain required paths.

### @signal-meaning/voice-agent-backend (packages/voice-agent-backend)

| Rule | Assertion |
|------|-----------|
| **Must include** | `src/`, `README.md`. After ISSUE-445: the OpenAI proxy entry (e.g. `scripts/openai-proxy/run.ts` or equivalent) so backends can run the proxy from this package. |
| **Must NOT include** | React components, test-app-only code, or root-level test-infra/publish scripts. |
| **Consumer** | Backends and test-app. Must be sufficient for backends to run both Deepgram (in-process) and OpenAI (spawn from this package) without the React package. |

Validation: packaging contract tests assert the backend package's published files include the proxy path (after move) and do not include forbidden paths.

### test-app

| Rule | Assertion |
|------|-----------|
| **Publish** | test-app is **not** a published package (no npm publish of test-app). It is a reference/demo app in the repo. |
| **Consumers** | Developers and E2E; it uses voice-agent-react (workspace or link) and voice-agent-backend. It must run the OpenAI proxy via the backend package path, not the React package (after ISSUE-445). |

Validation: no `package.json` publish config for test-app; E2E and integration tests assert proxy spawn uses backend package.

---

## How we validate

### 1. Packaging contract tests (automated)

**Location:** `tests/packaging/` (to add). Run with: `npm test -- tests/packaging` (or `jest tests/packaging`).

Tests encode the rules above:

- **React package:**  
  - Assert `npm pack --dry-run` (or the resolved file list from `package.json` `files`) does **not** contain `scripts/openai-proxy/` (and, after ISSUE-445, no `scripts/` or only an explicit allowlist).  
  - Optionally: assert required entries exist (`dist/`, `src/`, `README.md`).

- **Backend package:**  
  - Assert published `files` include `src/`, `README.md`.  
  - After ISSUE-445: assert proxy entry exists (e.g. `scripts/openai-proxy/run.ts` or path under the package).  
  - Assert no React-only or test-app-only paths.

- **Backend can run proxy without React:**  
  - Resolve `@signal-meaning/voice-agent-backend` (from repo or as if installed), assert proxy script path exists, optionally spawn and smoke-test.

- **test-app spawn:**  
  - Integration test or E2E asserts that when the test-app backend starts the OpenAI proxy, spawn cwd/path comes from the backend package, not the React package.

See **docs/issues/ISSUE-445/TDD-PLAN.md** for the RED/GREEN phases that introduce these tests.

### 2. CI

- Run packaging contract tests in CI (e.g. in the same job as unit tests or in a dedicated "packaging" step).  
- Optionally: run `validate:packaging` (or `npm test -- tests/packaging`) before publish so a stray `files` change cannot ship the proxy in the React package.

### 3. Pre-publish checklist

- **Release checklist** (e.g. in release checklist docs): confirm packaging tests pass and that no new script or path was added to the React package's `files` without updating this policy and the tests.

### 4. When adding or moving scripts

- **Before adding** a script to repo root or a package: check the allocation in **docs/issues/ISSUE-445/README.md** (Script and artifact allocation). If it's backend-runnable, it belongs in the backend (or dedicated) package, not in the React package. If it's test-infra or publish, it must not be in the React package's `files`.  
- **After changing** `files` in any published package: run packaging contract tests and update this policy if the rules change.

### 5. When adding or moving documentation

- **Issue docs** (`docs/issues/`) are internal only: we do not update them as we ship, and they are **not** released to customers. `docs/.npmignore` excludes `issues/` so the React package tarball never contains them.
- **Customer-facing or permanent docs** must live **outside** `docs/issues/` (e.g. `docs/`, `docs/BACKEND-PROXY/`, `docs/releases/`, `docs/development/`). If something in `docs/issues/` is needed for customers or long-term, move it to the appropriate permanent location.

---

## Source of truth for "what belongs where"

The detailed allocation (which script lives where, and who consumes it) is in **docs/issues/ISSUE-445/README.md** under "Script and artifact allocation (current state)." That table is the audit. This policy is the **executable summary**: the rules we enforce with tests and CI. When in doubt, the allocation table defines the intended state; this document and the tests define how we validate it.

---

## References

- **docs/issues/ISSUE-445/README.md** — Bug report, principles, script allocation tables, acceptance criteria.
- **docs/issues/ISSUE-445/TDD-PLAN.md** — TDD phases for ISSUE-445 (proxy move and React package files).
- **docs/issues/ISSUE-445/VALIDATION.md** — How to validate packaging decisions (this repo).
- **docs/PUBLISHING-AND-RELEASING.md** — Publish flow and tokens.
