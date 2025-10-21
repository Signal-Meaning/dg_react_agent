# Manual TTS Mute Testing Guide

## How to Test TTS Mute Functionality Manually

### Prerequisites
1. Make sure the test app is running: `cd test-app && npm run dev`
2. Open browser to `http://localhost:5173/`
3. Have a valid Deepgram API key configured

### Test Steps

#### 1. Basic TTS Mute Test
1. **Start the connection**: Click "Start" button
2. **Wait for connection**: Status should show "connected"
3. **Send a message**: Type "Hello, tell me a story" and click Send
4. **Listen for TTS**: You should hear the agent speaking
5. **Mute TTS**: Click the "🔇 TTS MUTED" button while audio is playing
6. **Observe**: Audio should stop immediately (muted)
7. **Unmute TTS**: Click "🔊 TTS ENABLED" button
8. **Observe**: Audio should resume from where it left off

#### 2. Mute Before TTS Starts
1. **Start connection**: Click "Start" button
2. **Mute immediately**: Click "🔇 TTS MUTED" button before sending any message
3. **Send message**: Type "Hello" and click Send
4. **Observe**: No audio should play (TTS is muted)
5. **Unmute**: Click "🔊 TTS ENABLED" button
6. **Observe**: TTS should start playing

#### 3. State Persistence Test
1. **Start connection**: Click "Start" button
2. **Mute TTS**: Click "🔇 TTS MUTED" button
3. **Send multiple messages**: Send several messages
4. **Observe**: No audio should play for any message
5. **Unmute**: Click "🔊 TTS ENABLED" button
6. **Send another message**: Should now hear TTS

#### 4. Visual Feedback Test
1. **Observe button states**:
   - Unmuted: "🔊 TTS ENABLED" with green styling
   - Muted: "🔇 TTS MUTED" with red styling
2. **Check status indicator**: Look for "TTS Muted: true/false" in component states

### Expected Behavior

#### ✅ **Correct Behavior:**
- Mute button immediately stops audio playback
- Unmute button resumes audio from current position
- Button visual state clearly indicates mute/unmute status
- Mute state persists across multiple messages
- Status indicator shows current mute state

#### ❌ **Issues to Report:**
- Audio continues playing when muted
- Audio doesn't resume when unmuted
- Button state doesn't match actual mute status
- Mute state doesn't persist

### Technical Details

The TTS mute functionality works by:
1. **Server-side control**: When muted, the `ttsMuted` prop prevents server from sending TTS
2. **Client-side fallback**: If audio is already playing, it's redirected to a silent gain node
3. **State persistence**: Mute state is maintained across reconnections and interactions

### Troubleshooting

If TTS isn't working at all:
1. Check browser console for errors
2. Verify Deepgram API key is valid
3. Check browser audio permissions
4. Ensure microphone permissions are granted

If mute isn't working:
1. Check that `ttsMuted` prop is being passed correctly
2. Verify `onTtsMuteToggle` callback is firing
3. Check AudioManager mute state in browser dev tools
