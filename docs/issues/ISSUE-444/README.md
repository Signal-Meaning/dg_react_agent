# Issue #444: Remove references to old package name (deepgram-voice-interaction-react)

**GitHub:** [Signal-Meaning/dg_react_agent#444](https://github.com/Signal-Meaning/dg_react_agent/issues/444)  
**Status:** In progress  
**Branch:** `davidrmcgee/issue444`

## Summary

Voice commerce has fully switched to `@signal-meaning/voice-agent-react` and no longer uses `@signal-meaning/deepgram-voice-interaction-react`. This issue requests removal of references to the old (deepgram) package name in source and release material to reduce confusion.

## Scope (from issue, refined)

- Search and update **source code** and **forward-looking docs** (migration guides, test-app docs, templates) for mentions of `@signal-meaning/deepgram-voice-interaction-react` or the "deepgram" naming where it refers to this deprecated package.
- Ensure those materials reflect the **current** package (`@signal-meaning/voice-agent-react` or `dg_react_agent` as appropriate).
- **Out of scope:** We do **not** update prior issue docs or documentation of prior releases; those stay as historical record.

## Current package identity

- **npm package:** `@signal-meaning/voice-agent-react` (see root `package.json`)
- **Repo / product name:** `dg_react_agent`

## Resolution plan

See **[RESOLUTION-PLAN.md](./RESOLUTION-PLAN.md)** for the detailed plan, file inventory, and acceptance checklist.
