# Release Notes - v0.10.1

**Release Date**: March 2026  
**Type**: Patch release

## Summary

v0.10.1 patches v0.10.0 with the fix for **#508** (idle timeout firing before the next agent turn when that turn is a function call — chained function calls). Partner report: voice-commerce #1058. No API changes.

## Fix included

- **#508:** IdleTimeoutService now clears "waiting for next agent message" and stops the max-wait timer when a new function call starts (`FUNCTION_CALL_STARTED`), so the connection stays open between a function result and the next (chained) function call. Fixes mandate-style flows (e.g. create_mandate → create_cart_mandate → execute_mandate) closing on idle after the first function result.

## Packages

- **@signal-meaning/voice-agent-react** — 0.10.1
- **@signal-meaning/voice-agent-backend** — 0.2.6 (unchanged)

## See also

- [CHANGELOG.md](./CHANGELOG.md) — Full changelog
