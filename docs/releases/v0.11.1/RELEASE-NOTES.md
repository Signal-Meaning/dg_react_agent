# Release Notes — v0.11.1

**Packages:** `@signal-meaning/voice-agent-react@0.11.1`, `@signal-meaning/voice-agent-backend@0.2.13`

Patch release: **OpenAI relay** (`createOpenAIWss`) queues client WebSocket messages until the upstream connection to the translator is open, fixing lost **Settings** on the relay hop (Issue **#571**, PR **#572**).

Upgrade **`@signal-meaning/voice-agent-backend`** to **0.2.13** if you use the bundled upgrade proxy with OpenAI proxy mode. See [CHANGELOG.md](./CHANGELOG.md).
