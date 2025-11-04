# Issue #243: Enhanced Echo Cancellation Support and Browser Compatibility

## Problem Statement

The agent voice may trigger itself when the microphone picks up audio from speakers. While basic echo cancellation is currently enabled in `AudioManager.ts`, we need to:

1. **Verify echo cancellation is working correctly** across different browsers
2. **Identify browser support and limitations** for echo cancellation
3. **Provide fallback options** when native echo cancellation is insufficient or unavailable
4. **Make echo cancellation configurable** via component API

### Current Implementation

Echo cancellation is currently hardcoded in `src/utils/audio/AudioManager.ts`:

```299:306:src/utils/audio/AudioManager.ts
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
```

### Issues with Current Implementation

1. **No Verification**: Echo cancellation is requested but not verified to be active
2. **Not Configurable**: Users cannot enable/disable or configure echo cancellation
3. **No Browser Detection**: No awareness of browser support or limitations
4. **No Fallback**: No client-side VAD-based echo cancellation when browser support is insufficient
5. **No Validation**: Constraints are not validated before applying

## Goals

### Primary Goals
1. **Browser Echo Cancellation Support Detection**
   - Detect and verify browser support for echo cancellation
   - Verify echo cancellation is actually active (not just requested)
   - Document browser-specific limitations and behaviors

2. **Enhanced Echo Cancellation Configuration**
   - Make echo cancellation configurable via component props
   - Allow users to enable/disable and configure audio constraints
   - Validate constraints before applying

3. **Client-Side VAD for Echo Detection (Diagnostics Only)**
   - Implement client-side Voice Activity Detection for monitoring
   - Use VAD to detect and analyze echo patterns
   - Provide diagnostic information about echo cancellation effectiveness
   - Note: VAD is for diagnostics only - microphone remains active at all times

### Secondary Goals
- Improve audio quality and reduce self-triggering
- Document browser compatibility matrix
- Provide developer guidance for audio setup

## Technical Foundation

### Browser Echo Cancellation Detection

**Browser APIs Used:**
- **`MediaTrackSettings.echoCancellation`**: Property that indicates if echo cancellation is enabled/active on an audio track
  - Access via: `stream.getAudioTracks()[0].getSettings().echoCancellation`
  - Returns: `boolean | undefined` (true if active, false if disabled, undefined if unknown)
  - Reference: [MDN: MediaTrackSettings.echoCancellation](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/echoCancellation)

- **`MediaTrackSupportedConstraints`**: API to check if browser supports specific constraints
  - Access via: `navigator.mediaDevices.getSupportedConstraints()`
  - Returns: Object with boolean properties for each supported constraint
  - Reference: [MDN: MediaTrackSupportedConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSupportedConstraints)

- **`MediaTrackConstraints.echoCancellation`**: Constraint to request echo cancellation
  - Used in: `getUserMedia({ audio: { echoCancellation: true } })`
  - Reference: [MDN: MediaTrackConstraints.echoCancellation](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation)

**Browser Behavior:**
- **Chrome/Edge**: Implements adaptive echo cancellation through WebRTC. Chrome also supports `echoCancellationType` constraint (experimental) to choose between browser software or native system echo canceller.
- **Firefox**: Supports echo cancellation but behavior may vary.
- **Safari**: Supports echo cancellation with some limitations.
- **Note**: Requesting echo cancellation doesn't guarantee it's active - must verify via `getSettings()`.

### Client-Side Voice Activity Detection

**Approach: Build using Web Audio API (No External Dependencies)**

We will implement a lightweight client-side VAD using native Web Audio API rather than external libraries to:
- Avoid additional dependencies
- Maintain full control over the implementation
- Keep bundle size minimal
- Ensure compatibility with existing audio pipeline

**Web Audio API Components Used:**
- **`AnalyserNode`**: Analyzes audio frequency data in real-time
  - Access via: `audioContext.createAnalyser()`
  - Methods: `getByteFrequencyData()`, `getByteTimeDomainData()`
  - Reference: [MDN: AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)

- **`MediaStreamAudioSourceNode`**: Connects microphone stream to audio graph
  - Access via: `audioContext.createMediaStreamSource(stream)`
  - Reference: [MDN: MediaStreamAudioSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioSourceNode)

**VAD Algorithm:**
- **Frequency Analysis**: Use `AnalyserNode` to analyze audio frequency spectrum
- **Energy Calculation**: Calculate RMS (Root Mean Square) energy from time-domain data
- **Threshold Comparison**: Compare energy against configurable threshold
- **Smoothing**: Apply smoothing to reduce false positives/negatives
- **Duration Filtering**: Require minimum speech/silence durations to avoid rapid toggling

**Alternative Libraries (Not Used, But Available):**
- **`voixen-vad`**: WebRTC-based VAD library extracted from Chromium
  - URL: https://github.com/voixen/voixen-vad
  - Pros: Production-ready, proven algorithm
  - Cons: Additional dependency, may be overkill for our use case

- **`voice-activity-detection`**: Simple npm package for browser VAD
  - URL: https://www.npmjs.com/package/voice-activity-detection
  - Pros: Simple API, lightweight
  - Cons: Additional dependency, less control

**Decision: Build Custom Implementation**
- We'll implement a lightweight VAD using Web Audio API's `AnalyserNode`
- This provides sufficient accuracy for echo cancellation (detecting when user vs agent is speaking)
- No external dependencies required
- Full control over thresholds and behavior

### Microphone Muting Technology

**Browser API Used:**
- **`MediaStreamTrack.enabled`**: Property to enable/disable audio track
  - Access via: `stream.getAudioTracks()[0].enabled = false`
  - Setting to `false` mutes the track (stops sending audio data)
  - Setting to `true` unmutes the track
  - Reference: [MDN: MediaStreamTrack.enabled](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/enabled)

**Implementation Strategy:**
- When agent starts speaking: Set `track.enabled = false` on all microphone tracks
- When agent stops speaking: Set `track.enabled = true` on all microphone tracks
- This provides instant muting/unmuting without re-establishing the stream

## References

- [Deepgram Voice Agent Echo Cancellation Guide](https://developers.deepgram.com/docs/voice-agent-echo-cancellation)
- [Deepgram Voice Agent Audio Playback - Using Echo Cancellation](https://developers.deepgram.com/docs/voice-agent-audio-playback#using-echo-cancellation)
- [MDN: MediaTrackSettings.echoCancellation](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/echoCancellation)
- [MDN: MediaTrackConstraints.echoCancellation](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation)
- [MDN: MediaTrackSupportedConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSupportedConstraints)
- [MDN: AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- [MDN: MediaStreamAudioSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioSourceNode)
- [MDN: MediaStreamTrack.enabled](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/enabled)
- [Chrome: More Native Echo Cancellation](https://developer.chrome.com/blog/more-native-echo-cancellation/)

## Implementation Plan

### Phase 1: Browser Echo Cancellation Support Detection

#### 1.1 Create Echo Cancellation Detection Utility

**File:** `src/utils/audio/EchoCancellationDetector.ts` (new)

**Responsibilities:**
- Detect browser support for echo cancellation
- Verify echo cancellation is actually active
- Report browser-specific limitations

**API:**
```typescript
interface EchoCancellationSupport {
  supported: boolean;
  active: boolean;
  browser: string;
  version?: string;
  limitations?: string[];
}

class EchoCancellationDetector {
  static async detectSupport(stream: MediaStream): Promise<EchoCancellationSupport>;
  static async verifyActive(stream: MediaStream): Promise<boolean>;
  static getBrowserInfo(): { browser: string; version?: string };
}
```

**Implementation Steps:**
- [ ] Create utility class to detect browser support
- [ ] Use `MediaTrackSettings.echoCancellation` via `stream.getAudioTracks()[0].getSettings().echoCancellation` to verify active state
- [ ] Use `navigator.mediaDevices.getSupportedConstraints()` to check browser support
- [ ] Detect browser type and version using `navigator.userAgent`
- [ ] Document known limitations per browser (Chrome, Firefox, Safari, Edge)
- [ ] Add unit tests for detection logic with mocked MediaStream

#### 1.2 Integrate Detection into AudioManager

**File:** `src/utils/audio/AudioManager.ts`

**Changes:**
- [ ] Call `EchoCancellationDetector.detectSupport()` after `getUserMedia`
- [ ] Log detection results (debug mode)
- [ ] Emit detection results via events
- [ ] Store detection results for component access

**Implementation:**
```typescript
// After getUserMedia succeeds
const support = await EchoCancellationDetector.detectSupport(this.microphoneStream);
this.log('Echo cancellation support:', support);

if (!support.active) {
  this.log('⚠️ Echo cancellation requested but not active');
}

// Emit event for component
this.emit({ 
  type: 'echoCancellationSupport', 
  support 
});
```

### Phase 2: Enhanced Echo Cancellation Configuration

#### 2.1 Add Audio Constraints to Component Props

**File:** `src/types/index.ts`

**Add to `DeepgramVoiceInteractionProps`:**
```typescript
interface AudioConstraints {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
  channelCount?: number;
}

interface DeepgramVoiceInteractionProps {
  // ... existing props
  
  /**
   * Audio constraints for getUserMedia
   * @default { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
   */
  audioConstraints?: AudioConstraints;
}
```

**Implementation Steps:**
- [ ] Add `AudioConstraints` interface to types
- [ ] Add `audioConstraints` prop to component props
- [ ] Provide sensible defaults
- [ ] Update TypeScript exports

#### 2.2 Pass Constraints to AudioManager

**File:** `src/components/DeepgramVoiceInteraction/index.tsx`

**Changes:**
- [ ] Extract `audioConstraints` from props
- [ ] Pass constraints to AudioManager during initialization
- [ ] Merge with defaults if not provided

**Implementation:**
```typescript
const audioConstraints = props.audioConstraints || {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

// Pass to AudioManager
const audioManager = new AudioManager({
  // ... other options
  audioConstraints,
});
```

#### 2.3 Update AudioManager to Accept Constraints

**File:** `src/utils/audio/AudioManager.ts`

**Changes:**
- [ ] Add `audioConstraints` to `AudioManagerOptions`
- [ ] Use constraints in `getUserMedia` call
- [ ] Validate constraints before applying
- [ ] Fall back to defaults if constraints are invalid

**Implementation:**
```typescript
interface AudioManagerOptions {
  // ... existing options
  audioConstraints?: AudioConstraints;
}

// In startRecording()
const constraints = {
  audio: {
    echoCancellation: this.options.audioConstraints?.echoCancellation ?? true,
    noiseSuppression: this.options.audioConstraints?.noiseSuppression ?? true,
    autoGainControl: this.options.audioConstraints?.autoGainControl ?? true,
    sampleRate: this.options.audioConstraints?.sampleRate,
    channelCount: this.options.audioConstraints?.channelCount ?? 1,
  },
  video: false,
};

this.microphoneStream = await navigator.mediaDevices.getUserMedia(constraints);
```

#### 2.4 Add Constraint Validation

**File:** `src/utils/audio/AudioConstraintValidator.ts` (new)

**Responsibilities:**
- Validate audio constraints before applying
- Check browser support for specific constraints
- Provide helpful error messages

**Implementation Steps:**
- [ ] Create validator utility
- [ ] Use `navigator.mediaDevices.getSupportedConstraints()` to check browser support for each constraint
- [ ] Validate constraint values (e.g., sampleRate ranges: typically 8000-48000 Hz)
- [ ] Check for invalid constraint combinations
- [ ] Provide helpful error messages for unsupported constraints
- [ ] Add unit tests with mocked `getSupportedConstraints()`

### Phase 3: Client-Side VAD for Echo Detection (Optional - Conditional on Evaluation)

**⚠️ PHASE 3 IS CONDITIONAL**

**This phase should only be implemented if evaluation after Phase 1 & 2 determines browser echo cancellation is insufficient.** See "Decision Framework" section below for evaluation criteria.

**⚠️ CRITICAL CONSTRAINT: Preserve Barge-In Functionality**

The component's barge-in feature allows users to interrupt the agent while it's speaking. This is implemented by:
1. Keeping microphone active during agent playback
2. Detecting `UserStartedSpeaking` events from Deepgram API
3. Aborting playback when user starts speaking

**Therefore, we CANNOT mute the microphone during agent playback** - this would break barge-in.

**Revised Approach:**
- Use VAD to detect and filter echo (agent's own voice) from the audio stream
- Keep microphone active to preserve barge-in
- Focus on improving browser echo cancellation rather than aggressive muting
- Use VAD as a detection/filtering tool, not a muting mechanism

#### 3.1 Create Client-Side VAD Utility (For Echo Detection Only)

**File:** `src/utils/audio/ClientVAD.ts` (new)

**Responsibilities:**
- Detect voice activity using Web Audio API
- Distinguish between user speech and agent echo
- Analyze audio levels to determine speech patterns
- Provide callbacks for voice activity (but NOT for muting)

**API:**
```typescript
interface VADOptions {
  threshold?: number; // Voice activity threshold (0-1)
  smoothing?: number; // Smoothing factor for detection
  minSpeechDuration?: number; // Minimum speech duration in ms
  minSilenceDuration?: number; // Minimum silence duration in ms
}

interface VADCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onVoiceActivity?: (isActive: boolean) => void;
}

class ClientVAD {
  constructor(audioContext: AudioContext, stream: MediaStream, options?: VADOptions);
  start(): void;
  stop(): void;
  setCallbacks(callbacks: VADCallbacks): void;
}
```

**Implementation Steps:**
- [ ] Create VAD utility using `AnalyserNode` from Web Audio API
- [ ] Implement voice activity detection algorithm:
  - Use `AnalyserNode.getByteTimeDomainData()` to get audio samples
  - Calculate RMS (Root Mean Square) energy from samples
  - Compare energy against configurable threshold
  - Apply smoothing filter to reduce false positives/negatives
  - Require minimum speech/silence durations to avoid rapid toggling
- [ ] Connect microphone stream via `MediaStreamAudioSourceNode`
- [ ] Add configurable thresholds (energy level, smoothing factor, durations)
- [ ] Add callbacks for speech start/end events
- [ ] Add unit tests with mocked AudioContext and MediaStream

#### 3.2 Use VAD for Echo Detection (Not Muting)

**File:** `src/utils/audio/AudioManager.ts`

**Changes:**
- [ ] Create VAD instance when recording starts (optional, configurable)
- [ ] Monitor audio patterns to detect potential echo
- [ ] Log echo detection events for debugging
- [ ] Provide feedback to component about echo detection quality
- [ ] **DO NOT mute microphone** - preserve barge-in functionality

**Implementation:**
```typescript
private vad: ClientVAD | null = null;

// In startRecording() - only if VAD echo detection is enabled
if (this.options.enableVADEchoDetection) {
  this.vad = new ClientVAD(this.audioContext, this.microphoneStream, {
    threshold: 0.3,
    smoothing: 0.1,
  });
  
  this.vad.setCallbacks({
    onVoiceActivity: (isActive: boolean) => {
      // Log for debugging - don't mute!
      if (this.isPlaying && isActive) {
        this.log('⚠️ Potential echo detected during playback (expected if barge-in not enabled)');
      }
    },
  });
  
  this.vad.start();
}

// Note: We do NOT mute during playback - this would break barge-in!
// Browser echo cancellation should handle echo filtering.
```

#### 3.3 Enhanced Echo Cancellation Strategy

**Approach: Focus on Browser Echo Cancellation Only**

**CRITICAL: No Microphone Muting**

The microphone must ALWAYS remain active to preserve barge-in functionality. Users must be able to interrupt the agent at any time.

**Strategy:**
1. **Verify browser echo cancellation is active** (Phase 1)
2. **Make echo cancellation configurable** (Phase 2)
3. **Use VAD for monitoring/diagnostics only** (Phase 3)
4. **Rely entirely on browser's adaptive echo cancellation** to filter agent's voice

**No Muting Implementation:**
- Microphone tracks remain enabled at all times
- Audio capture continues during agent playback
- Browser echo cancellation handles echo filtering
- VAD provides diagnostics to verify echo cancellation effectiveness

#### 3.4 Add VAD Configuration to Component Props

**File:** `src/types/index.ts`

**Add to `DeepgramVoiceInteractionProps`:**
```typescript
interface VADEchoDetectionOptions {
  enabled?: boolean;
  threshold?: number;
  smoothing?: number;
}

interface DeepgramVoiceInteractionProps {
  // ... existing props
  
  /**
   * Client-side VAD options for echo detection and diagnostics
   * Note: VAD is used for monitoring only, NOT for muting (to preserve barge-in)
   * Microphone remains active at all times to allow users to interrupt the agent
   */
  vadEchoDetection?: VADEchoDetectionOptions;
}
```

### Phase 4: Testing and Documentation

#### 4.1 Unit Tests

**Files to Create:**
- `tests/utils/audio/EchoCancellationDetector.test.ts`
- `tests/utils/audio/AudioConstraintValidator.test.ts`
- `tests/utils/audio/ClientVAD.test.ts`

**Test Coverage:**
- [ ] Echo cancellation detection across browsers
- [ ] Constraint validation
- [ ] VAD detection accuracy
- [ ] VAD diagnostics output
- [ ] Integration with AudioManager
- [ ] Verification that microphone stays active

#### 4.2 E2E Tests

**File:** `test-app/tests/e2e/echo-cancellation.spec.js` (new)

**Test Scenarios:**
- [ ] Echo cancellation is active in Chrome
- [ ] Echo cancellation is active in Firefox
- [ ] Echo cancellation is active in Safari
- [ ] VAD echo detection provides useful diagnostics
- [ ] **Microphone remains active during agent playback** (barge-in preserved)
- [ ] **No muting occurs** (microphone tracks stay enabled)
- [ ] Configurable constraints are applied correctly

#### 4.3 Documentation

**Files to Update:**
- `docs/releases/v0.5.0/API-REFERENCE.md` (or next version)
- `README.md`
- Create `docs/ECHO-CANCELLATION-GUIDE.md` (new)

**Documentation Sections:**
- [ ] Browser compatibility matrix
- [ ] Echo cancellation configuration guide
- [ ] VAD-based echo cancellation guide
- [ ] Troubleshooting common issues
- [ ] Best practices for audio setup

## Decision Framework: When is Client-Side VAD Needed?

### Evaluation Process

**After Phase 1 (Browser Detection) and Phase 2 (Configuration):**

Before implementing Phase 3 (Client-Side VAD), we need to evaluate whether browser echo cancellation is sufficient.

### Evaluation Criteria

**1. Browser Echo Cancellation Effectiveness**
- [ ] **Active in Major Browsers**: Echo cancellation is verified as active in Chrome, Firefox, Safari, and Edge
- [ ] **No Self-Triggering**: Agent does not trigger itself when using speakers (not headphones)
- [ ] **User Reports**: No significant user complaints about echo or self-triggering
- [ ] **Test Results**: E2E tests show echo cancellation working effectively across different audio setups

**2. Browser Coverage**
- [ ] **Major Browsers Supported**: Chrome, Firefox, Safari, Edge all have echo cancellation active
- [ ] **Fallback Needed**: If any major browser lacks sufficient echo cancellation, VAD may be needed
- [ ] **Documented Limitations**: Known browser limitations are documented and acceptable

**3. Real-World Testing**
- [ ] **Speaker Setup Testing**: Test with various speaker configurations (built-in speakers, external speakers, Bluetooth)
- [ ] **Volume Levels**: Test at different volume levels to ensure echo cancellation works across range
- [ ] **Environment Testing**: Test in different acoustic environments (quiet room, noisy room, office)

### Decision Matrix

**Proceed with Phase 3 (Client-Side VAD) if:**
- ✅ Browser echo cancellation is NOT active in one or more major browsers
- ✅ Self-triggering issues persist despite browser echo cancellation being active
- ✅ User reports indicate echo cancellation is insufficient
- ✅ Testing shows echo cancellation fails in common use cases (speakers, not headphones)

**Skip Phase 3 (Client-Side VAD) if:**
- ✅ Browser echo cancellation is active and effective in all major browsers
- ✅ No self-triggering issues reported
- ✅ Testing confirms echo cancellation works well in common scenarios
- ✅ VAD would only provide marginal improvement (not worth development effort)

**Note:** Since VAD is for diagnostics only (not muting), Phase 3 is lower priority. If browser echo cancellation is sufficient, Phase 3 can be deferred or skipped entirely.

### Validation Approach

**After Phase 1 & 2, conduct:**
1. **Automated Testing**: E2E tests across browsers with various audio setups
2. **Manual Testing**: Real-world testing with speakers (not headphones)
3. **User Feedback**: Collect feedback from early adopters about echo issues
4. **Metrics**: Track self-triggering incidents (if possible)

**Decision Point:**
- After Phase 2 completion, review evaluation criteria
- Make go/no-go decision for Phase 3 based on evaluation results
- Document decision and rationale

## Success Criteria

### Phase 1: Browser Detection ✅
- [ ] Echo cancellation support is detected and verified
- [ ] Detection results are logged (debug mode)
- [ ] Detection results are available via events
- [ ] Unit tests cover detection logic
- [ ] Browser compatibility matrix is documented

### Phase 2: Configuration ✅
- [ ] Echo cancellation is configurable via component props
- [ ] Constraints are validated before applying
- [ ] Invalid constraints are handled gracefully
- [ ] Default constraints are applied if not specified
- [ ] API documentation is updated

### Phase 3: VAD Echo Detection ✅ (Conditional)
**Note: Only implement if evaluation after Phase 1 & 2 determines it's needed**

- [ ] Evaluation completed after Phase 2 (see Decision Framework)
- [ ] Decision made to proceed with Phase 3 (or decision to skip/defer)
- [ ] If proceeding: Client-side VAD is implemented for echo detection
- [ ] If proceeding: VAD detects voice activity patterns accurately
- [ ] If proceeding: VAD provides diagnostic information about echo
- [ ] **Microphone ALWAYS remains active** during playback (preserves barge-in)
- [ ] **No muting implementation** - microphone tracks stay enabled
- [ ] If proceeding: VAD is configurable via component props
- [ ] If proceeding: Unit tests cover VAD functionality
- [ ] E2E tests verify barge-in still works
- [ ] E2E tests verify microphone remains active during playback

### Phase 4: Testing & Documentation ✅
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Documentation is complete
- [ ] Browser compatibility matrix is accurate
- [ ] Migration guide is provided (if needed)

## API Changes

### New Props

```typescript
interface DeepgramVoiceInteractionProps {
  /**
   * Audio constraints for getUserMedia
   * @default { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
   */
  audioConstraints?: AudioConstraints;
  
  /**
   * Client-side VAD-based echo cancellation options
   */
  vadEchoCancellation?: VADEchoCancellationOptions;
}
```

### New Types

```typescript
interface AudioConstraints {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
  channelCount?: number;
}

interface VADEchoDetectionOptions {
  enabled?: boolean;
  threshold?: number;
  smoothing?: number;
}

interface EchoCancellationSupport {
  supported: boolean;
  active: boolean;
  browser: string;
  version?: string;
  limitations?: string[];
}
```

### New Events

```typescript
// Emitted by AudioManager
interface EchoCancellationSupportEvent {
  type: 'echoCancellationSupport';
  support: EchoCancellationSupport;
}
```

## Breaking Changes

**None** - All new features are opt-in and backward compatible. Existing code will continue to work with default echo cancellation enabled.

## Migration Guide

### Before (v0.5.0)

```typescript
// Echo cancellation was hardcoded and not configurable
<DeepgramVoiceInteraction
  agentOptions={agentOptions}
  onAgentUtterance={handleUtterance}
/>
```

### After (v0.5.1+)

```typescript
// Echo cancellation is configurable
<DeepgramVoiceInteraction
  agentOptions={agentOptions}
  audioConstraints={{
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
  }}
  vadEchoDetection={{
    enabled: true, // For diagnostics only - microphone always active
    threshold: 0.3,
  }}
  onAgentUtterance={handleUtterance}
/>
```

**Note:** Microphone remains active at all times to preserve barge-in functionality. Echo cancellation is handled entirely by the browser.

## Implementation Notes

### Browser Echo Cancellation Behavior

According to Deepgram documentation:
- **Chrome**: Implements adaptive echo cancellation effectively through WebRTC
- **Firefox**: Supports echo cancellation but may have different behavior
- **Safari**: Supports echo cancellation with some limitations
- **Edge**: Similar to Chrome (Chromium-based)

### Echo Cancellation Strategy (Preserving Barge-In)

**Primary Approach: Browser Echo Cancellation Only**
1. Verify browser echo cancellation is active (Phase 1)
2. Make echo cancellation configurable (Phase 2)
3. Rely entirely on browser's adaptive echo cancellation to filter agent's voice
4. **No microphone muting** - microphone remains active at all times

**VAD Role: Monitoring and Diagnostics Only**
1. Use client-side VAD to detect voice activity patterns
2. Monitor for potential echo (but don't mute)
3. Provide diagnostic information about echo cancellation effectiveness
4. Help identify when browser echo cancellation might not be working

**Critical Constraint: Preserve Barge-In**
- **Microphone MUST remain active at all times** during agent playback to allow barge-in
- Muting the microphone would break the `UserStartedSpeaking` detection
- Users must be able to interrupt the agent at any time
- **No muting implementation** - solution relies entirely on browser echo cancellation

### Performance Considerations

- VAD processing adds minimal overhead (uses AnalyserNode)
- No muting/unmuting overhead (microphone stays active)
- No impact on audio quality when VAD is disabled
- Browser echo cancellation is hardware-accelerated in most browsers

## Related Issues

- Issue #239: Audio tracks hanging after connection close (may relate to echo cancellation)
- Issue #190: Missing agent state handlers (agent state needed for VAD integration)
- Issue #44: VAD Events Implementation (may provide VAD data)

## Timeline Estimate

- **Phase 1**: 2-3 days (Browser detection)
- **Phase 2**: 2-3 days (Configuration)
- **Evaluation**: 1-2 days (Decision framework evaluation after Phase 2)
- **Phase 3**: 3-4 days (VAD implementation - **conditional, only if needed**)
- **Phase 4**: 2-3 days (Testing & documentation)

**Total if Phase 3 is needed**: ~10-15 days
**Total if Phase 3 is skipped**: ~7-10 days

**Note:** Phase 3 should only be implemented if evaluation determines browser echo cancellation is insufficient.

## Risks and Mitigations

### Risk 1: Browser Support Varies
- **Mitigation**: Comprehensive browser testing, fallback to VAD

### Risk 2: VAD Accuracy Issues
- **Mitigation**: Configurable thresholds, smoothing, extensive testing

### Risk 3: Performance Impact
- **Mitigation**: Lightweight VAD implementation, optional feature

### Risk 4: Breaking Changes
- **Mitigation**: All features are opt-in, backward compatible defaults

---

**Status**: 🟡 **PLANNING** - Ready for implementation

**Labels**: `feature`, `enhancement`, `audio`, `voice-agent`, `browser-compatibility`

