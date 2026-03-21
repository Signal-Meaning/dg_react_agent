# Issue #538: `think.provider.temperature` vs WebSocket `session.update` (Section 5.4)

**Epic:** [#542](./README.md)  
**Status:** Resolved (do not forward on `session.update`; document + test)

## Problem

React/types and `buildSettingsMessage` expose `agent.think.provider.temperature` on **Settings** JSON. The proxy must map component **Settings** to OpenAI Realtime **WebSocket** `session.update`, whose `session` object is typed in the API reference as **`RealtimeSessionCreateRequest`** with `type: "realtime"`. That schema does **not** include `temperature`. Sending `session.temperature` caused live upstream **`unknown_parameter: 'session.temperature'`** (Mar 2026).

## Decision

- **Keep** `thinkTemperature` → `agent.think.provider.temperature` on **Settings** (component/UI parity; `buildSettingsMessage.ts`).
- **Do not** set `session.temperature` in `mapSettingsToSessionUpdate` / WebSocket `session.update`.
- **Document** the full `session` mapping in [REALTIME-SESSION-UPDATE-FIELD-MAP.md](../../../packages/voice-agent-backend/scripts/openai-proxy/REALTIME-SESSION-UPDATE-FIELD-MAP.md).

## Verification

- [x] Unit: `agent.think.provider.temperature` is **not** present on mapped `session.update` (`tests/openai-proxy.test.ts`).
- [x] Unit: full optional Settings → expected `session` keys; no `temperature` (`tests/openai-proxy.test.ts`).
- [x] Unit: Settings JSON still includes `agent.think.provider.temperature` when `thinkTemperature` is set (`tests/buildSettingsMessage.test.ts`).
- [x] **Real API:** Omitting `session.temperature` avoids `unknown_parameter`. Qualified with `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` (18 passed, 63 skipped mock-only; Mar 2026). If OpenAI adds `temperature` to `RealtimeSessionCreateRequest`, re-open mapping with a new issue.

## References

- [session.update (client event)](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update)
- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `mapSettingsToSessionUpdate`
- `src/utils/buildSettingsMessage.ts` — `thinkTemperature`
