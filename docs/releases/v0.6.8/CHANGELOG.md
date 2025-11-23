# Changelog: v0.6.8

**Component**: `DeepgramVoiceInteraction`  
**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Release Date**: January 2025  
**Previous Version**: v0.6.7

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## ✨ Added

### sendResponse Callback Parameter to onFunctionCallRequest
- **Issue #293 / PR #296**: Added `sendResponse` as second parameter to `onFunctionCallRequest` callback
  - **Enhancement**: The `onFunctionCallRequest` callback now receives a `sendResponse` function as its second parameter, eliminating the need for component refs and null checks
  - **Benefits**:
    - Simplifies function call response handling
    - Eliminates need for component refs and null checks
    - More ergonomic API for handling function calls
    - Maintains backward compatibility with ref-based `sendFunctionCallResponse` method
  - **Usage Example**:
    ```typescript
    <DeepgramVoiceInteraction
      onFunctionCallRequest={(request, sendResponse) => {
        // Directly use sendResponse without refs
        sendResponse({
          result: { success: true }
        });
      }}
    />
    ```
  - **Type Exports**: Exported `FunctionCallRequest` and `FunctionCallResponse` types for better TypeScript support
  - **Test Coverage**: Added comprehensive test coverage (13 tests) verifying:
    - Callback receives sendResponse parameter
    - sendResponse function works correctly
    - Backward compatibility with ref-based method
    - Error handling and edge cases
  - **Impact**: Improves developer experience when handling function calls

## 🐛 Fixed

### Thinking State for Client-Side Function Calls
- **Issue #294 / PR #297**: Fixed missing thinking state emission for client-side function calls
  - **Problem**: When a `FunctionCallRequest` was received for client-side functions, the component did not transition to the 'thinking' state, causing inconsistent state behavior
  - **Root Cause**: The thinking state transition was only triggered for server-side function calls, not client-side ones
  - **Fix**: 
    - Added state transition to 'thinking' when `FunctionCallRequest` is received for client-side functions
    - Extracted `transitionToThinkingState()` helper function to eliminate code duplication
    - Improved type safety with proper `FunctionCallRequestMessage` interface
  - **Impact**: Component now correctly emits thinking state for all function calls, providing consistent state management
  - **Test Coverage**: 
    - Added comprehensive unit tests (6 tests, all passing)
    - Verified no regressions in existing agent state handling tests (45 tests, all passing)
  - **Code Quality**: Improved code organization by extracting helper function and improving type safety

## 🔗 Related Issues

- [#293](https://github.com/Signal-Meaning/dg_react_agent/issues/293) - Add sendResponse callback parameter to onFunctionCallRequest
- [#294](https://github.com/Signal-Meaning/dg_react_agent/issues/294) - Emit thinking state for client-side function calls
- [#296](https://github.com/Signal-Meaning/dg_react_agent/pull/296) - Add sendResponse callback parameter to onFunctionCallRequest
- [#297](https://github.com/Signal-Meaning/dg_react_agent/pull/297) - Fix Issue #294: Emit thinking state for client-side function calls

## 📝 Commits Included

- `b2c23d3` - feat: Add sendResponse callback parameter to onFunctionCallRequest (issue #293) (#296)
- `9fda538` - docs: Add proposal for Issue #294 - thinking state for function calls
- `d17729f` - fix: Emit thinking state when FunctionCallRequest received (Issue #294)
- `4eed27d` - refactor: Extract thinking state transition helper and improve type safety (Issue #294)

---

**Full Changelog**: [v0.6.7...v0.6.8](https://github.com/Signal-Meaning/dg_react_agent/compare/v0.6.7...v0.6.8)

