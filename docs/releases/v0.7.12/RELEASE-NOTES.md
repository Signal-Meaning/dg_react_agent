# Release Notes - v0.7.12

**Release Date**: February 2026  
**Release Type**: Patch Release

## Overview

v0.7.12 fixes the OpenAI proxy flow so that an agent reply is received after the first text message sent via `injectUserMessage`. Previously, the upstream could close with code 1000 before replying; the proxy now waits for `conversation.item.added` (or `conversation.item.done`) from upstream before sending `response.create`, matching the OpenAI Realtime API expectation.

## Fix (Issue #388)

- **OpenAI proxy**: Send `response.create` only after upstream sends `conversation.item.added` or `conversation.item.done` for InjectUserMessage. This keeps the connection open and allows the agent to reply.
- **Tests**: Integration test for the ordering; E2E `openai-inject-connection-stability.spec.js` passes with real proxy.
- **Docs**: ISSUE-388 RESOLUTION-PLAN and OPENAI-REALTIME-API-REVIEW.

## Migration

No migration required. Fully backward compatible.
