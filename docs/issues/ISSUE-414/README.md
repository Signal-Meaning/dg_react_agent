# Issue #414: CLI script – OpenAI proxy integration (text-in, playback + text of agent responses)

**Branch:** `davidrmcgee/issue414`  
**GitHub:** [#414](https://github.com/Signal-Meaning/dg_react_agent/issues/414)  
**Labels:** enhancement

---

## Summary

Add or extend a script that integrates with the OpenAI proxy to send command-line text as input and play back and display the agent's spoken and text responses.

---

## Goals

- **Input:** Text provided via command line (e.g. `script "Hello, what's the weather?"`) or stdin.
- **Integration:** Script connects to the existing OpenAI proxy (e.g. `ws://127.0.0.1:8080/openai` when backend is running) and uses the same protocol as the component (Settings, `conversation.item.create` / inject user message, etc.).
- **Output:**
  - **Playback:** Play agent TTS audio (e.g. via system audio or saved file).
  - **Text:** Show agent response text (transcript or response content) in the terminal or to stdout.

---

## Scope

- New script or extension of an existing script (e.g. under `scripts/openai-proxy/` or `scripts/`) that:
  - Accepts API key (env or flag) and optional proxy URL.
  - Sends one or more user text messages and receives agent responses.
  - Renders response text and plays audio (or optionally text-only mode).
- Document how to run the backend and then this script for quick CLI testing of the proxy.

---

## Acceptance criteria

- [x] Script takes text input from CLI (args or stdin).
- [x] Script connects to OpenAI proxy and sends user message(s); receives and displays agent text.
- [x] Option to play agent TTS audio (or skip if text-only).
- [x] Docs or usage (e.g. `--help`) for running with `npm run backend` and the script.

---

## Status

### Done

- **Tests (TDD):** `tests/integration/openai-proxy-cli.test.ts` – minimal WebSocket server that speaks the component protocol; CLI with `--text`, stdin, and `--help`; all three tests pass.
- **CLI script:** `scripts/openai-proxy/cli.ts` – connects to proxy, sends Settings → waits for SettingsApplied → sends InjectUserMessage → prints assistant ConversationText; supports `--url`, `--text`, `--text-only`, `--help`; reads message from stdin when `--text` is omitted.
- **Docs:** `scripts/openai-proxy/README.md` – "CLI (Issue #414)" section: how to run backend then CLI, examples, `npm run openai-proxy:cli`.
- **npm script:** `openai-proxy:cli` in `package.json` for `npm run openai-proxy:cli -- --text "..."`.

### Remaining

- Optional: play agent TTS audio when not `--text-only` (e.g. write to temp file and play with system player, or stream to speaker). Current implementation is text-only; playback can be added later.

---

## References

- OpenAI proxy: `scripts/openai-proxy/` (e.g. `run.ts`, `server.ts`)
- Backend: `npm run backend`; proxy URL typically `ws://127.0.0.1:8080/openai`
- Component–proxy protocol: `docs/BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md`, `docs/BACKEND-PROXY/INTERFACE-CONTRACT.md`
