# GitHub Issue: Refactor to Singleton Service Pattern

## Title
**Refactor to Singleton Service Pattern - Replace Separate WebSocket Managers**

## Labels
- `bug`
- `enhancement` 
- `architecture`
- `high-priority`

## Problem Description

The current component implementation uses separate `WebSocketManager` instances for transcription and agent services, which doesn't align with the Deepgram SDK API pattern. The component should use a **single WebSocket connection** that operates in different modes based on configuration.

## Current Architecture Issues

- **Separate WebSocket Connections**: Currently using `transcriptionManagerRef` and `agentManagerRef` as separate `WebSocketManager` instances
- **Inconsistent with Deepgram SDK**: The Deepgram SDK API uses a single WebSocket that operates in different modes (transcription-only, agent-only, dual mode)
- **VAD Events Not Working**: The separate service architecture is preventing VAD events from working properly in tests
- **Complex State Management**: Managing two separate connections adds unnecessary complexity

## Target Architecture

Based on the [Deepgram React Agent repository](https://github.com/deepgram/dg_react_agent) and Deepgram SDK API:

1. **Single WebSocket Connection**: One connection that handles both transcription and agent functionality
2. **Mode-based Operation**: Connection operates in different modes based on which options are provided:
   - **Transcription-only mode**: When only `transcriptionOptions` is provided
   - **Agent-only mode**: When only `agentOptions` is provided  
   - **Dual mode**: When both `transcriptionOptions` and `agentOptions` are provided
3. **Settings-driven Configuration**: Mode and capabilities are determined when settings are sent to the WebSocket
4. **VAD Events**: Enable VAD events through the settings message sent to the single WebSocket

## Implementation Tasks

- [ ] Refactor `WebSocketManager` usage to use single connection
- [ ] Update service initialization logic to determine mode based on provided options
- [ ] Modify settings message handling to configure the single WebSocket appropriately
- [ ] Update VAD event handling to work with singleton service
- [ ] Update connection state management for single connection
- [ ] Update error handling for unified service
- [ ] Update tests to work with singleton service pattern
- [ ] Remove separate `transcriptionManagerRef` and `agentManagerRef` references

## Expected Benefits

- **Simplified Architecture**: Single WebSocket connection reduces complexity
- **Better VAD Support**: VAD events should work properly with unified service
- **Improved Performance**: Single connection reduces overhead
- **Better Alignment**: Matches Deepgram SDK API patterns
- **Easier Testing**: Simpler architecture makes testing more straightforward

## Priority

**High** - This is blocking VAD event functionality and doesn't align with the target Deepgram SDK API architecture.

## Related

- Current VAD event issues in E2E tests
- Need to align with Deepgram SDK API patterns
- Reference: https://github.com/deepgram/dg_react_agent

## Code References

Current problematic code locations:
- `src/components/DeepgramVoiceInteraction/index.tsx` lines 546-556 (transcription manager)
- `src/components/DeepgramVoiceInteraction/index.tsx` lines 600-610 (agent manager)
- Separate refs: `transcriptionManagerRef` and `agentManagerRef`

## Acceptance Criteria

- [ ] Single WebSocket connection handles all functionality
- [ ] Mode determined by provided options (transcription, agent, or dual)
- [ ] VAD events work properly in all modes
- [ ] All existing tests pass
- [ ] Performance is maintained or improved
- [ ] Code is cleaner and more maintainable
