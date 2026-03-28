# Issue #544 — Scope

**GitHub:** [#544](https://github.com/Signal-Meaning/dg_react_agent/issues/544)

**Release:** `@signal-meaning/voice-agent-react` **0.10.5**, `@signal-meaning/voice-agent-backend` **0.2.10**

**Content source:** [Epic #542](../ISSUE-542/README.md), merged in [PR #543](https://github.com/Signal-Meaning/dg_react_agent/pull/543).

---

## Goal

Publish a **patch** so consumers pick up the Voice Commerce OpenAI proxy defect register work (Epic #542, §1–§6): observability, protocol ordering, client JSON handling, Settings → Realtime `session` mapping, lifecycle and contract alignment, and the associated tests and documentation.

---

## In scope

- OpenAI proxy: `packages/voice-agent-backend/scripts/openai-proxy/` (including `server.ts`, `translator.ts`, logging, client JSON hardening).
- React headless component and Settings message construction / types aligned with proxy expectations.
- Jest unit and integration tests (including `tests/integration/openai-proxy-integration.test.ts` and related files).
- Documentation updates under `docs/BACKEND-PROXY/`, proxy `PROTOCOL-AND-MESSAGE-ORDERING.md`, and related protocol docs tied to Epic #542.
- Release artifacts under `docs/releases/v0.10.5/` when the release is cut.

---

## Out of scope

- New epic scope beyond Epic #542 §1–§6 (follow-ups get new issues).
- Changing the Voice Agent API compatibility contract (this release remains a **patch**).

---

## Surfaces and packages

| Area | Touched | Notes |
|------|---------|--------|
| React component (`src/`) | Yes | Settings / protocol alignment with proxy |
| OpenAI proxy (`packages/voice-agent-backend/scripts/openai-proxy/`) | Yes | Primary surface for Epic #542 |
| test-app | As needed | E2E and manual verification |
| Jest (`tests/`) | Yes | Integration and unit coverage for proxy and component |
| Playwright (`test-app/tests/e2e/`) | Yes for qualification | Proxy mode; real API when qualifying |
| **@signal-meaning/voice-agent-react** | **Publish 0.10.5** | Root package |
| **@signal-meaning/voice-agent-backend** | **Publish 0.2.10** | Proxy ships with backend package |

---

## Acceptance criteria

- [ ] Versions **0.10.5** (root) and **0.2.10** (backend) are set on the release branch and published as intended.
- [ ] [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) qualification complete (including real-API integration when keys are available, or a documented exception on Issue #544).
- [ ] `docs/releases/v0.10.5/` present and `npm run validate:release-docs 0.10.5` passes.
- [ ] GitHub Issue #544 closed after successful publish and merge of `release/v0.10.5` to `main`.

---

## Related issues

- [#542 Epic](../ISSUE-542/README.md)
- [#543 PR](https://github.com/Signal-Meaning/dg_react_agent/pull/543) (implementation merge)
- [#462 Voice Commerce function-call expectations](../ISSUE-462/README.md)
