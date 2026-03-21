# Epic #542: Voice Commerce OpenAI proxy defect register (Sections 1–6)

**GitHub:** [#542 Epic: Voice Commerce OpenAI proxy defect register](https://github.com/Signal-Meaning/dg_react_agent/issues/542)

**Labels:** epic, protocol, voice-agent

**Source:** Parent tracker for the Voice Commerce defect report *DEFECT-REPORT-DG-REACT-AGENT-UPSTREAM* (OpenAI translation proxy plus component protocol), Sections 1–6. Section 7 triage steps apply when closing the epic.

---

## TDD bundles (recommended)

Work can proceed issue-by-issue, but these groupings share code paths and tests:

| Bundle | Issues | Shared surface | Primary tests | Done |
|--------|--------|----------------|---------------|------|
| **A — Observability** | [#531](./ISSUE-531.md) | `logger.ts` `initProxyLogger` / `emitLog`; `run.ts` defaults | Unit: logger; integration: synthetic upstream `error` with env unset | - [x] |
| **B — Ordering / protocol** | [#534](./ISSUE-534.md), [#532](./ISSUE-532.md) | `server.ts` `forwardClientMessage`, `session.updated`, `hasSentSettingsApplied`, tools path | `tests/integration/openai-proxy-integration.test.ts` (extend with Settings+tools + early inject; close codes) | - [ ] |
| **C — Client JSON boundary** | [#533](./ISSUE-533.md) | `server.ts` client JSON handling (Issue #533) | Integration: unknown `type` → Error; KeepAlive not forwarded; passthrough flag test | - [x] |
| **D — Settings → Realtime session** | [#535](./ISSUE-535.md)–[#540](./ISSUE-540.md) | `translator.ts` `mapSettingsToSessionUpdate`, component `Settings` types, `buildSettingsMessage` | `tests/openai-proxy.test.ts` (mapper snapshots); integration: outbound `session.update` shape with `USE_REAL_APIS=1` when needed | - [ ] |
| **E — Lifecycle / contract docs** | [#541](./ISSUE-541.md) | `PROTOCOL-AND-MESSAGE-ORDERING.md`, `COMPONENT-PROXY-CONTRACT.md`, React handlers for `SettingsApplied` | Doc audit + targeted unit/integration: duplicate `SettingsApplied`, no duplicate `session.update` | - [ ] |

Implement **D** after **C** if you remove passthrough before new Settings fields land, or implement **D** first and **C** last if you temporarily rely on passthrough for gaps (document the threat model either way).

Mark a bundle **Done** when every issue in that bundle has all TDD phase boxes checked in its doc (including **Verified**), or deferrals are recorded in that issue’s Notes.

---

## Related docs in this repo

- [ISSUE-462: Voice Commerce function-call follow-up](../ISSUE-462/README.md) — partner-reported defects, real-API and backend HTTP expectations (`.cursorrules`).
- [ISSUE-512-515: OpenAI proxy unmapped events, retries](../ISSUE-512-515/README.md) — adjacent proxy and release-gate work.
- [packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) — message order, `response.create`, `SettingsApplied`.
- [docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md) — client obligations (e.g. readiness).

---

## Child issues

| Issue | Title | Local doc |
|-------|--------|-----------|
| **#531** | Always log Realtime `error` without `LOG_LEVEL` / `OPENAI_PROXY_DEBUG` (Section 1) | [ISSUE-531.md](./ISSUE-531.md) |
| **#532** | Protocol Error after Settings with functions; repro Section 2b; close frames (Section 2) | [ISSUE-532.md](./ISSUE-532.md) |
| **#533** | Harden client JSON passthrough (Section 3) | [ISSUE-533.md](./ISSUE-533.md) |
| **#534** | Queue `InjectUserMessage` until session ready (Section 4) | [ISSUE-534.md](./ISSUE-534.md) |
| **#535** | `session.tool_choice` from Settings (Section 5.1) | [ISSUE-535.md](./ISSUE-535.md) |
| **#536** | `session.output_modalities` (Section 5.2) | [ISSUE-536.md](./ISSUE-536.md) |
| **#537** | `session.max_output_tokens` (Section 5.3) | [ISSUE-537.md](./ISSUE-537.md) |
| **#538** | `temperature` in `session.update` or remove type (Section 5.4) | [ISSUE-538.md](./ISSUE-538.md) |
| **#539** | Managed session prompt id/variables (Section 5.5) | [ISSUE-539.md](./ISSUE-539.md) |
| **#540** | `session` audio.output on Settings (Section 5.6) | [ISSUE-540.md](./ISSUE-540.md) |
| **#541** | Lifecycle gaps; client-event audit; `SettingsApplied` idempotence (Section 6) | [ISSUE-541.md](./ISSUE-541.md) |

---

## Epic checklist (report Section 7)

Use the child issues above for implementation and verification. When closing the epic:

- [ ] Each child issue is closed or explicitly deferred with rationale.
- [ ] Proxy or component changes that depend on upstream ordering or timing are qualified per [.cursorrules](../../../.cursorrules) (real API where required; partner scenarios with appropriate coverage).
- [ ] Release checklist and version bump completed if shipping a release for this work.

---

## Progress (prioritized)

**Order:** (1) Make upstream failures visible without env tuning. (2) Remove the inject-vs-session race so repros are trustworthy. (3) Close the Voice Commerce Settings+tools protocol defect and close-frame observability. (4) Harden JSON **before** or **while** expanding Settings mapping—if passthrough is removed first, Section 5 must not rely on escape hatches. (5) Add Settings → `session` fields in a sensible dependency order. (6) Audit docs and idempotence after behavior stabilizes.

Check **Area done** when every linked issue’s **Verified** checklist in its doc is complete (or explicitly deferred with rationale in Notes).

| Priority | Area | Issues | Area done | Notes |
|----------|------|--------|-----------|-------|
| 1 | Section 1 — logging | [#531](./ISSUE-531.md) | - [x] | Code landed; optional manual stderr check remains in ISSUE-531 doc |
| 2 | Section 4 — `InjectUserMessage` gating | [#534](./ISSUE-534.md) | - [x] | Proxy queue landed; optional React enforcement + real-API check open in ISSUE-534 doc |
| 3 | Section 2 — protocol / Settings + functions | [#532](./ISSUE-532.md) | - [ ] | Mock Section 2b + client close log done; real-API row still open in ISSUE-532 |
| 4 | Section 3 — JSON hardening | [#533](./ISSUE-533.md) | - [x] | Strict default + `OPENAI_PROXY_CLIENT_JSON_PASSTHROUGH` escape hatch |
| 5 | Section 5 — Settings → session mapping | [#535](./ISSUE-535.md)–[#540](./ISSUE-540.md) | - [ ] | Sub-order below |
| 6 | Section 6 — lifecycle / audit / idempotence | [#541](./ISSUE-541.md) | - [ ] | Partially blocked on 533/534 until those ship |

### Section 5 sub-order (within priority 5)

Complete **Verified** on each child doc in this order unless dependencies dictate otherwise: **#538** (honest `temperature` surface) → **#535** `tool_choice` → **#536** `output_modalities` → **#537** `max_output_tokens` → **#539** managed prompt → **#540** `audio.output` (highest regression risk—last).

- [x] [#538](./ISSUE-538.md) temperature → `session.update` (unit + builder; real-API row open in ISSUE-538)
- [ ] [#535](./ISSUE-535.md) `tool_choice`
- [ ] [#536](./ISSUE-536.md) `output_modalities`
- [ ] [#537](./ISSUE-537.md) `max_output_tokens`
- [ ] [#539](./ISSUE-539.md) managed prompt id/variables
- [ ] [#540](./ISSUE-540.md) `session` audio.output
