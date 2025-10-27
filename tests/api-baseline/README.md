# API Baseline Documentation

## Purpose

This directory contains the source-of-truth baseline files for API validation. These files define what is "approved" vs "unauthorized" for both API layers.

## Structure

- **pre-fork-baseline.ts** - Component API methods from pre-fork commit (7191eb4)
- **official-deepgram-api.ts** - Official Deepgram Voice Agent v1 events (auto-generated from asyncapi.yml)
- **approved-additions.ts** - Post-fork component API additions with justification
- **approved-server-events.ts** - Server events handled by component but not in official spec
- **asyncapi.yml** - Official Deepgram API spec (for reference)
- **fetch-official-specs.ts** - Script to update official API spec

## Key Concepts

### API1: Deepgram Server → Component
Events sent FROM Deepgram server TO component. Source of truth is:
- Official: `asyncapi.yml` from github.com/deepgram/deepgram-api-specs
- Extracted: `official-deepgram-api.ts` (auto-generated)
- Deviations: `approved-server-events.ts` (manually maintained)

### API2: Component → test-app
Methods exposed BY component TO applications. Source of truth is:
- Pre-fork baseline: `pre-fork-baseline.ts` (commit 7191eb4)
- Post-fork additions: `approved-additions.ts` (manually maintained)

## Maintaining These Files

### Adding a Component Method

1. Create GitHub issue proposing the addition
2. Add to `approved-additions.ts` with:
   - Issue reference
   - Version added
   - Rationale
   - Breaking/non-breaking flag
3. Update release notes (API-CHANGES.md)

### Adding a Server Event Handler

1. Check if event exists in official asyncapi.yml
2. If official, update `official-deepgram-api.ts` by running `npm run api:fetch-spec`
3. If not official, add to `approved-server-events.ts` with justification

## Testing

Run `npm run api:validate` to ensure:
- All official server events are handled
- No unauthorized component methods exist
- All deviations are documented

