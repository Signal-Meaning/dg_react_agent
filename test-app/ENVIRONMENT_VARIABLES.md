# Environment Variables Configuration

This document describes the environment variables that can be used to configure the Deepgram Voice Interaction test application.

## Required Variables

### API Configuration
- `VITE_DEEPGRAM_API_KEY` - Your Deepgram API key (required)
- `VITE_DEEPGRAM_PROJECT_ID` - Your Deepgram project ID (required)

## Optional Variables

### Transcription Service Configuration
- `VITE_TRANSCRIPTION_MODEL` - Deepgram model to use for transcription (default: `nova-3`)
- `VITE_TRANSCRIPTION_LANGUAGE` - Language for transcription (default: `en-US`)
- `VITE_TRANSCRIPTION_SMART_FORMAT` - Enable smart formatting (default: `true`)
- `VITE_TRANSCRIPTION_INTERIM_RESULTS` - Enable interim results (default: `true`)
- `VITE_TRANSCRIPTION_DIARIZE` - Enable speaker diarization (default: `true`)
- `VITE_TRANSCRIPTION_CHANNELS` - Number of audio channels (default: `1`)
- `VITE_TRANSCRIPTION_VAD_EVENTS` - Enable VAD events (default: `true`)
- `VITE_TRANSCRIPTION_UTTERANCE_END_MS` - Utterance end detection timeout in ms (default: `1000`)
- `VITE_TRANSCRIPTION_URL` - Custom transcription WebSocket URL (default: `wss://api.deepgram.com/v1/listen`)

### Agent Service Configuration
- `VITE_AGENT_LANGUAGE` - Agent language (default: `en`)
- `VITE_AGENT_MODEL` - Deepgram model for agent listening (default: `nova-3`)
- `VITE_AGENT_THINK_MODEL` - LLM model for agent thinking (default: `gpt-4o-mini`)
- `VITE_AGENT_VOICE` - Agent voice (default: `aura-2-apollo-en`)
- `VITE_AGENT_GREETING` - Agent greeting message (default: `Hello! How can I assist you today?`)
- `VITE_AGENT_URL` - Custom agent WebSocket URL (default: `wss://agent.deepgram.com/v1/agent/converse`)
- `VITE_IDLE_TIMEOUT_MS` - Idle timeout in milliseconds (default: component default, e.g. 10000). When set, used for agent session and component; E2E runs use 30000 so the connection stays open long enough for audio-sending tests.

### Proxy Endpoints (E2E / real API tests)
- `VITE_DEEPGRAM_PROXY_ENDPOINT` - WebSocket URL for the Deepgram proxy (default: `ws://localhost:8080/deepgram-proxy`). Used by deepgram-text-session-flow and other Deepgram proxy E2E tests.
- `VITE_OPENAI_PROXY_ENDPOINT` - WebSocket URL for the OpenAI proxy (default: `ws://localhost:8080/openai`). When set, the openai-inject-connection-stability E2E test runs against that proxy.

### E2E Instructions Override
- `VITE_E2E_INSTRUCTIONS` - When set, the test-app uses this string as instructions instead of loading from file/env. Used only by the “response content reflects instructions” E2E test in `instructions-e2e.spec.js` (e.g. set to a BANANA instruction and run with `--grep "response content reflects"`). See [INSTRUCTIONS-E2E-PROPOSAL.md](../docs/issues/ISSUE-381/INSTRUCTIONS-E2E-PROPOSAL.md).

## Usage

Create a `.env` file in the `test-app` directory with your desired configuration:

```bash
# Required
VITE_DEEPGRAM_API_KEY=your-api-key-here
VITE_DEEPGRAM_PROJECT_ID=your-project-id-here

# Optional - override defaults
VITE_TRANSCRIPTION_MODEL=nova-2
VITE_TRANSCRIPTION_LANGUAGE=en-GB
VITE_AGENT_VOICE=aura-2-luna-en

# Optional - idle timeout (ms); E2E defaults to 30000 when started via Playwright
# VITE_IDLE_TIMEOUT_MS=30000

# Optional - proxy endpoints for E2E tests (set in test-app/.env)
# VITE_DEEPGRAM_PROXY_ENDPOINT=ws://localhost:8080/deepgram-proxy
# VITE_OPENAI_PROXY_ENDPOINT=ws://localhost:8080/openai
```

## Notes

- All environment variables are prefixed with `VITE_` to be accessible in the browser
- Boolean values should be set to `'true'` or `'false'` as strings
- Numeric values are automatically parsed from strings
- If an environment variable is not set, the default value will be used
- The application will show an error if required variables are missing or have placeholder values
