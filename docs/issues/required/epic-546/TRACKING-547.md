# Tracking — GitHub #547

**Issue:** [voice-agent-backend: ship selfsigned as runtime dependency (or drop HTTPS=1 require) — patch release](https://github.com/Signal-Meaning/dg_react_agent/issues/547)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

Consumers who install `@signal-meaning/voice-agent-backend` as a normal dependency must not hit **`MODULE_NOT_FOUND: selfsigned`** when using the documented path that previously set `HTTPS=1` / `HTTPS=true`.

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) (packaging rule)
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)
- [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md)

## TDD — RED

- [ ] Add a failing test or automated check that reproduces **consumer** install: production dependency tree resolves `run.ts` path with `HTTPS=1` (or equivalent post–#550 flag if #547 ships together with env changes — align with implementation).
- [ ] Confirm RED: `MODULE_NOT_FOUND: selfsigned` (or document that RED is “new test added; would have failed on 0.2.10”).

## TDD — GREEN

- [ ] Implement **Option A** and/or **Option B** per issue #547:
  - [ ] **Option A:** Move `selfsigned` from `devDependencies` to **`dependencies`** in `packages/voice-agent-backend/package.json`.
  - [ ] **Option B:** Remove or gate runtime `require('selfsigned')` so consumers never need the module unless they opt into dev TLS (may depend on #551; coordinate ordering).
- [ ] Test passes; proxy starts with the env scenario under test.

## TDD — REFACTOR

- [ ] No unnecessary duplication; comments only where contract is non-obvious.

## Definition of done

- [ ] `packages/voice-agent-backend/package.json` matches runtime needs for the chosen fix path.
- [ ] [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md) **Packaging smoke** section executed for this fix.
- [ ] Patch version published (e.g. **0.2.11**) or superseded by minor if bundled with breaking env changes (document in release notes). **Execution** of the full publish flow is tracked in GitHub [#554](https://github.com/Signal-Meaning/dg_react_agent/issues/554) and [ISSUE-554/TRACKING.md](./ISSUE-554/TRACKING.md).
- [ ] GitHub #547 closed with link to PR and this file.

## Verification log

_Add dated bullets: command, outcome._

- [ ] _Example: `npm pack` + temp install + start proxy — pass_
