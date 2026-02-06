# Issue #406: When / Why Upstream Closes, Root Cause, Fix

## When it happens

The **upstream** (proxy’s WebSocket to the OpenAI Realtime API) can close **before** the proxy has sent **SettingsApplied** to the client. In that case:

- The client never receives SettingsApplied.
- The host (and E2E) may see “connection closed” or timeouts on “wait for Settings applied.”
- Observed close codes include 1005 (“No Status Received”) and 1006 (abnormal closure).

So the failure occurs **during the readiness handshake**: after the client has sent Settings and the proxy has sent `session.update` to OpenAI, but before OpenAI has sent `session.updated` back (and before we send SettingsApplied to the client).

## Why (protocol / timing)

OpenAI’s Realtime API expects a clear ordering:

1. Client (our proxy) connects and sends **session.update**.
2. Server (OpenAI) responds with **session.updated** (or **session.created**).
3. Only after that is the session “ready” for conversation items and other operations.

If the proxy sends **conversation.item.create** (e.g. for `Settings.agent.context.messages`) **before** receiving **session.updated**, it violates that ordering. The API may then close the connection (e.g. 1005/1006) before ever sending `session.updated`.

## Root cause (in our proxy)

In `scripts/openai-proxy/server.ts`, when handling client **Settings** we were:

1. Sending **session.update** to upstream.
2. **Immediately** sending one **conversation.item.create** per context message to upstream.

So we sent conversation items **before** receiving **session.updated**. That protocol/timing bug is in **our** proxy and is a likely cause of upstream closing before session ready.

## Fix (defer context until after session.updated)

- On **Settings** from the client: send only **session.update** to upstream; **store** context messages as pending **conversation.item.create** payloads (do not send them yet).
- On **session.updated** or **session.created** from upstream: send all pending context items to upstream, **then** send **SettingsApplied** (and optional greeting) to the client.

Implementation details:

- `pendingContextItems: string[]` holds serialized `conversation.item.create` messages.
- When we receive `session.updated`/`session.created`, we send those items to upstream first, clear the list, then send SettingsApplied to the client. This keeps API ordering correct and ensures integration tests (which assert that the mock receives context items) see them after session.updated.

See: `scripts/openai-proxy/server.ts` (Settings handler, session.updated/session.created handler, `pendingContextItems`).

## Regression test

The integration test **"sends Settings.agent.context.messages as conversation.item.create to upstream"** (`tests/integration/openai-proxy-integration.test.ts`) now enforces the correct ordering. The mock can delay sending `session.updated` by 50ms; if the proxy sends any `conversation.item.create` before the mock has sent `session.updated`, a protocol error is recorded and the test fails with `expect(protocolErrors).toHaveLength(0)`. So any reversion to “context before session.updated” is caught by the test suite.

## Mitigation (already in place)

If the upstream still closes before we have sent SettingsApplied (e.g. due to network or OpenAI service issues), the proxy sends a component **Error** to the client with code `upstream_closed_before_session_ready` and a description including the upstream close code/reason, then closes the client. So the host gets a clear error instead of an opaque “connection closed.”
