# Tracking — GitHub #548

**Issue:** [voice-agent-backend: audit openai-proxy runtime imports vs package.json dependencies](https://github.com/Signal-Meaning/dg_react_agent/issues/548)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

Every `require()` / static `import` reachable when an integrator runs the **shipped** OpenAI proxy entrypoint must resolve from **`dependencies`** (or documented **`peerDependencies`**) of `@signal-meaning/voice-agent-backend`.

**Known audit items (initial):**

- `logger.ts` → `@opentelemetry/api-logs`, `@opentelemetry/sdk-logs` (currently `devDependencies` only).
- `run.ts` → `selfsigned` when HTTPS branch (tracked in [#547](./TRACKING-547.md)).
- `speaker-sink.ts` → `speaker` (confirm not executed on default subprocess path).

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) § Packaging rule
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)
- [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md)

## Inventory

- [ ] List all files under `packages/voice-agent-backend/scripts/openai-proxy/` with runtime imports/requires.
- [ ] Mark each symbol as: **default proxy path** / **CLI-only** / **optional dynamic**.
- [ ] Record table in this section (append below) or in a short `AUDIT-OPENAI-PROXY-DEPS.md` in this folder if the table is large.

```text
(File / import / default path? / required action)
```

## TDD — RED

- [ ] Add test or CI step that fails when a **required** runtime import is missing from `dependencies` (ideas: minimal install + `node -e "require('...')"` from package entry; or Jest that resolves modules as consumer).
- [ ] Or: integration test that boots proxy from compiled/copied tree without monorepo hoisting (document approach).

## TDD — GREEN

- [ ] Promote required packages to **`dependencies`** (OpenTelemetry packages if default path loads `logger.ts`).
- [ ] Or refactor so optional code paths use dynamic `import()` / `require()` only when feature flag + document `peerDependencies` if appropriate.

## TDD — REFACTOR

- [ ] Align `package.json` and lockfiles; no duplicate/conflicting version ranges without reason.

## Definition of done

- [ ] Inventory complete; no known gap between runtime path and `dependencies`.
- [ ] Tests / CI guard documented in PR.
- [ ] [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md) packaging smoke re-run after dep changes.
- [ ] GitHub #548 closed with link to PR and this file.

## Verification log

- [ ] _Root Jest + targeted integration: date / command / outcome_
- [ ] _Pack smoke: date / command / outcome_
