# Changelog - v0.7.14

**Release Date**: February 2026  
**Release Type**: Patch Release

## Added (Issue #397)

### Source included in package

- **Component source**: The published package now includes `src/` (component TypeScript source) in addition to built output (`dist/`). Entry point: `src/index.ts`; main component: `src/components/DeepgramVoiceInteraction/index.tsx`. Use `dist/` at runtime; use `src/` for reference or debugging.
- **Proxy source**: The package already included `scripts/` (e.g. `scripts/openai-proxy/`). This release makes it explicit that proxy source is part of the customer-facing reference (server, translator, run, logger).

### Source reference documentation

- **`docs/SOURCE-REFERENCE.md`**: New document that directs customers to the major source elements:
  - **Component**: `src/index.ts`, `src/components/DeepgramVoiceInteraction/`, `dist/` entry points, types, hooks, utils.
  - **OpenAI Realtime proxy**: `scripts/openai-proxy/server.ts` (WebSocket server, event ordering), `translator.ts` (mapping), `run.ts` (entry), `logger.ts` (optional debug). Includes a short explanation of what is built there (protocol translation, InjectUserMessage → response.create only after conversation.item.added/conversation.item.done).
  - **Deepgram proxy (test-app)**: `test-app/scripts/mock-proxy-server.js`, with pointer to `test-app/docs/PROXY-SERVER.md`.
  - Links to API-REFERENCE, BACKEND-PROXY, OPENAI-REALTIME-API-REVIEW, and PROXY-OWNERSHIP-DECISION.

## Backward Compatibility

✅ **Fully backward compatible** — Additive only. New files in package (`src/`, `docs/SOURCE-REFERENCE.md`); no API or behavior changes. Existing consumers continue to use `dist/` as before.
