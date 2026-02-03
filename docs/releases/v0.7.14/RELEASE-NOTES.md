# Release Notes - v0.7.14

**Release Date**: February 2026  
**Release Type**: Patch Release

## Overview

v0.7.14 adds **source to the published package** and **source reference documentation** so customers can use the shipped source as the reference implementation, especially for the proxy.

## Changes (Issue #397)

1. **Source in package**  
   - `package.json` `"files"` now includes `src/`. The package ships component source in addition to `dist/`, `docs/`, `scripts/`, and `test-app/`. Proxy source remains in `scripts/openai-proxy/`.

2. **Source reference doc**  
   - **`docs/SOURCE-REFERENCE.md`** points customers to:
     - Component: `src/index.ts`, main component, types, hooks, utils; built entry points in `dist/`.
     - OpenAI proxy: `server.ts`, `translator.ts`, `run.ts`, `logger.ts` with a brief explanation (protocol translation, event order: `response.create` only after `conversation.item.added` / `conversation.item.done`).
     - Deepgram proxy (test-app) and links to further docs.

3. **No behavior or API changes**  
   - Runtime behavior and public API are unchanged. This release is additive (more files, new doc).

## Migration

No migration required. Fully backward compatible.
