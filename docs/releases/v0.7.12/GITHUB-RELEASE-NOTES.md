# Release Notes - v0.7.12

**Release Date**: February 2026  
**Release Type**: Patch Release

## Overview

v0.7.12 fixes the OpenAI proxy so that an agent reply is received after the first text message sent via `injectUserMessage`. Previously, the upstream could close with code 1000 before replying; the proxy now waits for `conversation.item.added` (or `conversation.item.done`) from upstream before sending `response.create`, matching the OpenAI Realtime API expectation.

## 🎯 Release Highlights

### OpenAI proxy: agent reply after first text message (Issue #388)

**Problem**: When using the OpenAI provider with `injectUserMessage`, the upstream OpenAI WebSocket closed shortly after the first user message (code 1000), so no agent reply was received even though the component sent the message correctly.

**Solution**:
- Proxy sends `response.create` only **after** upstream sends `conversation.item.added` or `conversation.item.done` for the user message (InjectUserMessage flow).
- No other proxy behavior changed (audio commit, FunctionCallResponse, etc.).

**Impact**:
- ✅ E2E test `openai-inject-connection-stability.spec.js` — “should receive agent response after first text message” — passes with real OpenAI proxy.
- ✅ Integration test added for response.create ordering; mock sends item.added for user messages.
- ✅ Unit tests for closing mock and agent reply (issue-380-inject-upstream-close, openai-proxy).

## 🐛 Fixed

### OpenAI proxy (`scripts/openai-proxy/server.ts`)
- **Issue**: Proxy sent `response.create` immediately after `conversation.item.create` on InjectUserMessage; OpenAI Realtime API expects the client to wait for upstream confirmation first.
- **Solution**: On InjectUserMessage, proxy sends only `conversation.item.create` and sets a flag; it sends `response.create` when upstream sends `conversation.item.added` or `conversation.item.done`.

## 📊 Test Coverage

- **Integration**: New test “Issue #388: sends response.create only after receiving conversation.item.added from upstream”; existing InjectUserMessage test updated (mock sends item.added).
- **E2E**: `openai-inject-connection-stability.spec.js` passes with real proxy.
- **Unit**: issue-380-inject-upstream-close.test.tsx, openai-proxy.test.ts.

## 🔄 Backward Compatibility

✅ **Fully backward compatible** — No breaking changes. Proxy behavior change is limited to InjectUserMessage → response.create ordering; component API unchanged.

## 🔗 Related Issues

- Issue #388 (OpenAI upstream closes after first user message — no agent reply) ✅ **FIXED**
- Issue #380 (closed; related inject/connection context)

## 📝 Migration Guide

**No migration required** — Patch release; use the component as in v0.7.11.
