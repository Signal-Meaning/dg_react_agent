# API Changes - v0.6.0

## Overview

This release adds **new optional features** while maintaining **full backward compatibility**. All existing APIs remain unchanged and functional.

## Component Props

### New Props Added

```typescript
interface DeepgramVoiceInteractionProps {
  // ... existing props remain unchanged
  
  // NEW: Audio constraints for echo cancellation and audio processing
  /**
   * Audio constraints for getUserMedia
   * Used to configure echo cancellation and other audio processing features
   * 
   * @default { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
   * 
   * Issue: #243 - Enhanced Echo Cancellation Support
   */
  audioConstraints?: AudioConstraints;
  
  // NEW: Idle timeout active state change callback
  /**
   * Called when idle timeout active state changes (for testing/debugging)
   * Indicates whether the idle timeout timer is currently running
   * 
   * @param isActive - true if timeout timer is active, false otherwise
   * 
   * Issue: #244 - Idle Timeout State Tracking
   */
  onIdleTimeoutActiveChange?: (isActive: boolean) => void;
}
```

### AudioConstraints Interface

```typescript
/**
 * Audio constraints for getUserMedia
 * Used to configure echo cancellation and other audio processing features
 */
export interface AudioConstraints {
  /**
   * Enable echo cancellation
   * @default true
   */
  echoCancellation?: boolean;
  
  /**
   * Enable noise suppression
   * @default true
   */
  noiseSuppression?: boolean;
  
  /**
   * Enable automatic gain control
   * @default true
   */
  autoGainControl?: boolean;
  
  /**
   * Sample rate in Hz (e.g., 16000, 24000, 48000)
   * If not specified, browser default is used
   */
  sampleRate?: number;
  
  /**
   * Number of audio channels (1 = mono, 2 = stereo)
   * @default 1
   */
  channelCount?: number;
}
```

## Type Exports

### New Types Exported

The `AudioConstraints` interface is now exported from the main package:

```typescript
import { AudioConstraints } from '@signal-meaning/deepgram-voice-interaction-react';
```

**Note**: The `onIdleTimeoutActiveChange` callback type is part of `DeepgramVoiceInteractionProps` and doesn't require a separate import.

## Utility Classes

### New Utility: EchoCancellationDetector

**Location**: Internal utility (not directly exported, but available via component behavior)

**Purpose**: Automatically detects browser support for echo cancellation

**Key Methods** (internal):
- `detectSupport(stream: MediaStream)`: Detects echo cancellation support for a MediaStream
- `verifyActive(stream: MediaStream)`: Verifies if echo cancellation is currently active
- `getBrowserInfo()`: Gets browser name and version

**Usage** (via component):
The component automatically uses this detector internally to ensure echo cancellation is properly configured.

### New Utility: AudioConstraintValidator

**Location**: Internal utility (not directly exported)

**Purpose**: Validates audio constraints before applying them to `getUserMedia`

**Key Methods** (internal):
- `validate(constraints: AudioConstraints)`: Validates audio constraints
- `isConstraintSupported(constraintName: string)`: Checks if a specific constraint is supported

**Usage** (via component):
The component automatically validates constraints before applying them, ensuring compatibility and providing warnings for unsupported constraints.

## Existing APIs

### ✅ All Existing Props Remain Unchanged

- ✅ All existing component props remain unchanged
- ✅ All existing callbacks remain unchanged (new optional callback added)
- ✅ All existing state properties remain unchanged
- ✅ All existing methods remain unchanged

### ✅ Backward Compatibility

- ✅ If `audioConstraints` is not provided, component behaves exactly as before
- ✅ No breaking changes to any existing functionality
- ✅ All existing code continues to work without modification

## Usage Examples

### Basic Usage (No Changes Required)

```typescript
// Existing code continues to work without changes
<DeepgramVoiceInteraction
  apiKey="your-api-key"
  // ... existing props
/>
```

### Using Audio Constraints (New Optional Feature)

```typescript
// New optional feature - opt-in
<DeepgramVoiceInteraction
  apiKey="your-api-key"
  audioConstraints={{
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true
  }}
  // ... existing props
/>
```

### Advanced Audio Configuration

```typescript
<DeepgramVoiceInteraction
  apiKey="your-api-key"
  audioConstraints={{
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true,
    sampleRate: 48000,      // High quality audio
    channelCount: 1          // Mono audio
  }}
  // ... existing props
/>
```

## TypeScript Types

### Importing Types

```typescript
import type { 
  AudioConstraints,
  DeepgramVoiceInteractionProps,
  DeepgramVoiceInteractionHandle
} from '@signal-meaning/deepgram-voice-interaction-react';
```

### Type Definitions Location

All types are exported from the main package entry point:
- `dist/index.d.ts` - TypeScript definitions
- `dist/types/index.d.ts` - Internal type definitions

## Migration Guide

### No Migration Required

This release requires **no migration**:
- ✅ Existing code works without changes
- ✅ New features are opt-in
- ✅ No deprecated APIs
- ✅ No breaking changes

### Adopting New Features

To use echo cancellation, simply add the `audioConstraints` prop:

```typescript
// Before (still works)
<DeepgramVoiceInteraction
  apiKey="your-api-key"
  // ... props
/>

// After (optional enhancement)
<DeepgramVoiceInteraction
  apiKey="your-api-key"
  audioConstraints={{
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true
  }}
  // ... props
/>
```

## Browser Compatibility

### Audio Constraints Support

- **Chrome/Edge**: Full support for all audio constraints
- **Firefox**: Full support for all audio constraints
- **Safari**: Limited support (varies by version)
- **Fallback**: Component gracefully handles unsupported constraints

### Automatic Detection

The component automatically:
- Detects browser support for audio constraints
- Validates constraints before applying them
- Provides warnings for unsupported constraints
- Falls back gracefully when constraints are not supported

## Related Documentation

- [New Features](NEW-FEATURES.md) - Detailed echo cancellation feature documentation
- [Changelog](CHANGELOG.md) - Complete list of changes
- [Echo Cancellation Plan](../issues/ISSUE-243-ECHO-CANCELLATION-PLAN.md) - Implementation details
- [Issue #244](https://github.com/Signal-Meaning/dg_react_agent/issues/244) - Idle timeout state tracking fix

## Summary

| Change Type | Description | Breaking? |
|------------|-------------|-----------|
| **Added** | `audioConstraints` prop | ❌ No |
| **Added** | `onIdleTimeoutActiveChange` callback | ❌ No |
| **Added** | `AudioConstraints` type export | ❌ No |
| **Added** | Internal echo cancellation detection | ❌ No |
| **Added** | Internal constraint validation | ❌ No |
| **Changed** | None | - |
| **Deprecated** | None | - |
| **Removed** | None | - |

**Result**: ✅ **100% Backward Compatible** - No breaking changes

