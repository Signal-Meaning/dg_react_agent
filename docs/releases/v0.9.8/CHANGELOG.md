# Changelog - v0.9.8

**Release Date**: March 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #487 (voice-commerce #1058):** Idle timeout no longer fires while the component is waiting for the next agent message after the app has sent a function result. The connection stays open until the next agent message (e.g. next function call or final response) is received, then idle timeout may start as usual. Fixes mandate flow and other chained function-call scenarios where the model had not yet sent the next message.

## Added

- **Issue #487:** New idle-timeout event `AGENT_MESSAGE_RECEIVED` to clear the "waiting for next agent message after function result" state; `handleNextAgentMessageReceived()` on the idle timeout manager (internal).
- **Tests:** Idle timeout must not fire after function result until next agent message is received (repro for voice-commerce #1058).
- **Tests:** Closure and idle timeout with a few functions in parallel (STARTED/COMPLETED and `AGENT_MESSAGE_RECEIVED` behavior).

## Backward Compatibility

✅ **Fully backward compatible** — No breaking changes. No public API changes.

## References

- Issue #487: [Idle timeout fires while agent is still busy](https://github.com/Signal-Meaning/dg_react_agent/issues/487)
- Voice-commerce #1058 (AP2 mandate flow)
- docs/issues/ISSUE-489/ (release checklist)
