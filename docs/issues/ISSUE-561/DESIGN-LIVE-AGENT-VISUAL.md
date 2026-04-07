# Design proposal: Live mode agent visual (waveform / mouth)

**Issue:** [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561)  
**Goal:** A centered visual in Live mode that **reacts while the assistant is responding** (TTS playback), aligned with the reference aesthetic (glowing waveform “lips”, dark field). **Teeth should be subtler** than the reference—mostly hidden under the upper lip, low contrast, or omitted in early phases.

---

## Signals we can drive from the test-app today

| Signal | Meaning | Use |
|--------|---------|-----|
| `isPlaying` (from `onPlaybackStateChange`) | Assistant audio is actively playing | **Primary** driver for “speaking” motion |
| `agentState === 'speaking'` | Component-reported speaking | Supplement / lead-in before audio starts |
| `onAgentAudioChunk` (count / [RMS](#rms-and-analysernode)) | Chunks arriving | Optional **intensity** or **lip sync** if we add RMS in the app |
| `agentPresentation` | idle / listening / thinking / tool | Idle vs “busy” background motion (subtle) |

**Recommendation:** Phase 1 uses **`agentOutputActive = isPlaying || agentState === 'speaking'`** (already wired). Phase 2 can add **chunk-derived [RMS](#rms-and-analysernode)** or **[AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) on the playback graph** if we need amplitude-faithful motion (requires more plumbing; keep behind a small hook).

---

## Implementation options (ranked)

### 1) **SVG path + CSS / SMIL / `requestAnimationFrame`** (recommended baseline)

- **Upper and lower “lips”** as two polylines or paths; **animate `d` or control points** from a small buffer of energy samples (smoothed).
- **Teeth:** single **low-opacity** rounded rect strip, **clipped** so only the top ~20–30% peeks below the upper lip; or **no teeth** until Phase 3.
- **Pros:** Crisp on HiDPI, easy to theme (stroke glow via `filter: drop-shadow`), no canvas DPI issues.
- **Cons:** Path morphing needs care to avoid jank; cap update rate (~30–60 Hz) with smoothing.

### 2) **Canvas 2D**

- Draw waveform lips + teeth in one pass; read audio levels from [`AnalyserNode`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) if we tap the output chain (see [RMS and AnalyserNode](#rms-and-analysernode)).
- **Pros:** Maximum control, easy particle/glow layering.
- **Cons:** More code for hit-testing/accessibility; retina scaling boilerplate.

### 3) **Lip SVG + level bars** (current Phase 1 in `LiveAgentVisual.tsx`)

- Upper/lower **lip curves** (SVG paths) plus **tall vertical bars** with staggered **height** keyframes; idle uses a slow subtle pulse, active uses stronger motion while `agentOutputActive`.
- **Pros:** Reads as a simple “mouth” without full path morphing; still no RMS/`AnalyserNode` required.
- **Cons:** Motion is **decoupled from true audio level** until Phase 2/3 in this doc.

---

## Motion design notes

- **Smoothing:** Exponential moving average on amplitude so the mouth does not twitch per packet.
- **Rest state:** When not `agentOutputActive`, decay to a **narrow closed** pose over ~200–400 ms.
- **Thinking / tool:** Optional **slow breathing** scale on the whole glyph (very subtle) so the center never feels “dead” during latency.
- **Performance:** Prefer **CSS `transform` and `opacity`** over layout thrashing; avoid large `box-shadow` animations on low-end targets if this ever ships beyond the test-app.

---

## Accessibility

- Treat as **decorative:** `aria-hidden="true"` on the visual container (as now).
- Status remains in **labeled** text (`Mic activity`, `Assistant activity`, `Session`) and conversation history.

---

## Phased delivery

| Phase | Deliverable |
|-------|-------------|
| **1** | SVG lip outline + level bars + `agentOutputActive` (done in tree). |
| **2** | SVG lip outline driven by smoothed “energy” from playback or chunks. |
| **3** | Teeth under lip (clip + low contrast), optional [RMS](#rms-and-analysernode) from [`AnalyserNode`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode). |

---

## References

### RMS and AnalyserNode

- **[AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)** — Web Audio API node that exposes **time-domain** and **frequency-domain** data for visualization. Typical pattern: create via [`BaseAudioContext.createAnalyser()`](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createAnalyser), then each frame call [`getFloatTimeDomainData()`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatTimeDomainData) or [`getByteTimeDomainData()`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getByteTimeDomainData) and map samples to a level or waveform.
- **RMS (root mean square)** — A scalar **energy / loudness** measure over a window of samples (square root of the mean of squared sample values). Useful for smoothing mouth motion vs raw peaks. General definition: [Root mean square](https://en.wikipedia.org/wiki/Root_mean_square) (Wikipedia). In Web Audio, RMS is **not** a built-in property; you compute it from the buffer returned by `AnalyserNode` (or from decoded PCM chunks in the app) before driving SVG/canvas.

### Other

- In-repo reference images (user-provided): `.cursor/projects/.../assets/image-*.png` (mouth waveform concepts).
- Live shell: `test-app/src/live-mode/LiveModeView.tsx`, `test-app/src/live-mode/LiveAgentVisual.tsx`.
