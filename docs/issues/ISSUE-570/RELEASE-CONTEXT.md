# Issue #570 — release context (snapshot)

Captured when **`issue-570`** and this folder were created. Refresh if `main` moves materially before the release branch is cut.

---

## Baseline

| Item | Value |
|------|--------|
| **Last published git tag** | `v0.10.6` |
| **Root `package.json` (`@signal-meaning/voice-agent-react`)** | `0.10.6` → target **`0.11.0`** (minor) |
| **Backend `packages/voice-agent-backend/package.json`** | `0.2.11` → bump if publishing backend (often patch, e.g. `0.2.12`) |

---

## Semver (summary)

- **Recommended:** **Minor `v0.11.0`** — changes since `v0.10.6` include backward-compatible **features** (test-app Live mode flow, `functionCallInFlight` UX, OpenAI proxy commit scheduler / Server VAD, OTel logging #565, mic timing debug) as well as fixes (#559–#560).
- **Patch alternative:** `v0.10.7` only for an intentional **fix-only** release narrative (not aligned with current `main` history).

---

## Qualification reminders (from checklist)

This window touched **openai-proxy** and **audio** paths:

- Run **real-API** integration when keys are available: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`.
- E2E in **proxy mode** before publish: `cd test-app && npm run backend`, then `USE_PROXY_MODE=true npm run test:e2e` (from repo root per project scripts).
- **Upstream event coverage:** `npm test -- tests/openai-proxy-event-coverage.test.ts`.

---

## Regenerate commit list (optional)

```bash
git log v0.10.6..HEAD --oneline --reverse
```
