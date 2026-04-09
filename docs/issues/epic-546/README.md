# EPIC-546 — OpenAI proxy TLS, packaging, and host integration

**Start here.** This directory contains everything **required** to complete the epic using TDD, with **one tracking document per sub-issue** (checkbox-driven).

## GitHub

| Item | Link |
|------|------|
| Epic | [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546) |
| Tracking PR | [#553](https://github.com/Signal-Meaning/dg_react_agent/pull/553) (branch `epic/546-openai-proxy-tls`) |
| Package | `packages/voice-agent-backend` → `@signal-meaning/voice-agent-backend` |
| Proxy entrypoint | `packages/voice-agent-backend/scripts/openai-proxy/run.ts` |

## Shared documents (read before implementing)

| Document | Purpose |
|----------|---------|
| [TDD-EPIC-546.md](./TDD-EPIC-546.md) | **Epic TDD hub:** tracking index, test layers, commands, **#554 vs #555** (PR-first TDD vs pre-release) |
| [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) | Normative env contract and TLS modes (target behavior) |
| [PARTNER-REPORT-SUMMARY.md](./PARTNER-REPORT-SUMMARY.md) | Voice Commerce defect and asks (context) |
| [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md) | Version bump, pack install smoke, real-API / CI expectations |

## Per-issue tracking (checkboxes)

| # | Title | Tracking file |
|---|--------|-----------------|
| 547 | `selfsigned` packaging / patch release | [TRACKING-547.md](./TRACKING-547.md) |
| 548 | Runtime dependency audit (`openai-proxy`) | [TRACKING-548.md](./TRACKING-548.md) |
| 549 | TLS from PEM paths (mkcert-friendly) | [TRACKING-549.md](./TRACKING-549.md) |
| 550 | Scoped TLS env (no silent `HTTPS` inheritance) | [TRACKING-550.md](./TRACKING-550.md) |
| 551 | Explicit dev TLS + production guardrails | [TRACKING-551.md](./TRACKING-551.md) |
| 552 | Documentation (supported modes + integrators) | [TRACKING-552.md](./TRACKING-552.md) |
| 554 | **Execute patch release** (GitHub release template checklist) | [ISSUE-554/](./ISSUE-554/README.md) |
| 555 | **Real-API integration regression** (`USE_REAL_APIS`, bisect / fix / document) | [ISSUE-555-OPENAI-REAL-API-REGRESSION/](./ISSUE-555-OPENAI-REAL-API-REGRESSION/README.md) |

## Epic completion checklist (rollup)

Use this table for **at-a-glance** status. Detail lives in each `TRACKING-*.md`.

- [ ] **#547** — **Fix in tree** (`selfsigned` in `dependencies`, packaging test); **publish registry + close GitHub #547** still via release flow (see [TRACKING-547.md](./TRACKING-547.md), [#554](./ISSUE-554/TRACKING.md))
- [ ] **#548** — **Done in tree** for default `run.ts` path + packaging test; optional **`speaker`** CLI gap documented — **close GitHub #548** when merged (see [TRACKING-548.md](./TRACKING-548.md))
- [ ] **#549** — **Done in tree** (PEM env + `run.ts` + unit tests) — **close GitHub #549** when merged (see [TRACKING-549.md](./TRACKING-549.md))
- [ ] **#550** — **Done in tree** (`listen-tls` ignores bare `HTTPS`) — **close GitHub #550** when merged (see [TRACKING-550.md](./TRACKING-550.md))
- [ ] **#551** — **Done in tree** (`OPENAI_PROXY_INSECURE_DEV_TLS`, prod `fatal`) — **close GitHub #551** when merged (see [TRACKING-551.md](./TRACKING-551.md))
- [x] **#552** — Integrator-facing docs published; packaging rule stated (see [TRACKING-552.md](./TRACKING-552.md))
- [ ] **#554** — Patch release executed per [ISSUE-554/TRACKING.md](./ISSUE-554/TRACKING.md) and GitHub [#554](https://github.com/Signal-Meaning/dg_react_agent/issues/554)
- [ ] **Release qualification** — [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md) completed for the shipping version(s)
- [x] **#555** — Real-API / protocol regression **resolved** — [#557](https://github.com/Signal-Meaning/dg_react_agent/pull/557); GitHub [#555](https://github.com/Signal-Meaning/dg_react_agent/issues/555) closed **2026-04-09**. Detail: [ISSUE-555/TRACKING.md](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md).
- [ ] **GitHub** — Epic #546 and sub-issues closed with pointers to this folder

## Suggested implementation order

1. #547 (unblock consumers) → 2. #548 (correctness) → 3. #549–#551 (behavior contract, may overlap in one PR if tests drive it) → 4. #552 (finalize docs after behavior is stable) → 5. **#554** (run the release checklist and publish when code is ready).

**Parallel:** [#555](./ISSUE-555-OPENAI-REAL-API-REGRESSION/TRACKING.md) (Realtime protocol + test-app function-call E2E) can land on its own TDD → PR timeline; it is not gated on #547–#551 order unless the same PR bundles them.
