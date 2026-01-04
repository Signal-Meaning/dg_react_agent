# Changelog - v0.7.7

**Release Date**: January 3, 2026  
**Release Type**: Patch Release

## Fixed

- **Issue #353**: Fixed binary JSON message handling for FunctionCallRequest and other agent messages
  - Implemented binary JSON detection in `WebSocketManager.ts`
  - Added type validation against `AgentResponseType` enum
  - Handles both ArrayBuffer and Blob binary data
  - Maintains backward compatibility with text JSON messages
  - Comprehensive test coverage (12 Jest tests + E2E test)

## Changed

- `src/utils/websocket/WebSocketManager.ts`: Added `handleBinaryData()` method for binary JSON detection
- Enhanced type safety: Uses `AgentResponseType` enum constants instead of string literals
- Improved code quality: DRY principle, comprehensive JSDoc documentation

## Added

- `tests/websocket-binary-json.test.ts`: 12 comprehensive Jest unit tests for binary JSON handling
- `test-app/tests/e2e/issue-353-binary-json-messages.spec.js`: Playwright E2E test for Blob binary JSON
- Documentation in `docs/issues/ISSUE-353/` directory

## Security

- Type validation prevents non-agent JSON from being incorrectly routed as messages

