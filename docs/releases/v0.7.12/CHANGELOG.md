# Changelog - v0.7.12

**Release Date**: February 2026  
**Release Type**: Patch Release

## Fixed

### OpenAI proxy: agent reply after first text message (Issue #388)

- **Problem**: When using the OpenAI provider with `injectUserMessage`, the upstream OpenAI WebSocket closed shortly after the first user message (code 1000), so no agent reply was received even though the component sent the message correctly.
- **Root cause**: The proxy sent `response.create` immediately after `conversation.item.create` on InjectUserMessage. The OpenAI Realtime API expects the client to wait for upstream confirmation (`conversation.item.added` or `conversation.item.done`) before sending `response.create`.
- **Solution**: In `scripts/openai-proxy/server.ts`, on InjectUserMessage the proxy now sends only `conversation.item.create` to upstream and sets a flag; it sends `response.create` only when the upstream sends `conversation.item.added` or `conversation.item.done`. No other proxy behavior (e.g. audio commit, FunctionCallResponse) was changed.
- **Verification**: E2E test `openai-inject-connection-stability.spec.js` — “should receive agent response after first text message (real OpenAI proxy)” — passes with a real OpenAI proxy. Integration test added: “Issue #388: sends response.create only after receiving conversation.item.added from upstream”.

## Documentation

- **Issue #388**: README, RESOLUTION-PLAN (progress, acceptance checklist, next steps), OPENAI-REALTIME-API-REVIEW (event order and proxy fix).

## Test Coverage

- **Integration**: New test in `openai-proxy-integration.test.ts` for response.create ordering; mock sends `conversation.item.added` for user messages so existing InjectUserMessage test and Issue #388 test both pass.
- **E2E**: `openai-inject-connection-stability.spec.js` passes with real proxy.
- **Unit**: Issue #380/388 closing mock and agent-reply tests in `issue-380-inject-upstream-close.test.tsx`; openai-proxy unit tests in `openai-proxy.test.ts`.

## Backward Compatibility

✅ **Fully backward compatible** — No breaking changes. Proxy behavior change is limited to the InjectUserMessage → response.create ordering; component API unchanged.
