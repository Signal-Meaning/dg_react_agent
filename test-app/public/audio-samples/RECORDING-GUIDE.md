# Recording Guide for Pre-Recorded Audio Samples

## Shopping Concierge Question Sample

### Sample Name
`shopping-concierge-question`

### Text to Record
"Can you help me find a gift for my friend's birthday?"

### Recording Instructions

1. **Set up your recording environment:**
   - Use a quiet room with minimal background noise
   - Speak naturally and conversationally (as if asking a real shopping concierge)
   - Include natural pauses and speech patterns (this helps generate interim transcripts)

2. **Record the audio:**
   - Use Audacity or FFmpeg (see main README.md for detailed instructions)
   - Format: WAV, 16kHz, Mono, 16-bit PCM
   - Duration: Approximately 3-4 seconds of speech
   - **Important**: Speak naturally with slight pauses - this helps the API generate interim transcripts

3. **Save the file:**
   - Save as: `shopping-concierge-question.wav`
   - Location: `test-app/public/audio-samples/`
   - The system will automatically use this file instead of TTS generation

### Why Pre-Recorded Audio?

Pre-recorded human speech (non-TTS) is important for testing interim transcripts because:
- Real human speech has natural variations, pauses, and disfluencies
- The Deepgram API processes real speech differently than TTS audio
- Interim transcripts are more likely to appear with natural speech patterns
- TTS audio sent in chunks may be processed too quickly, resulting in only final transcripts

### Testing the Sample

Once you've added the WAV file, you can test it in the interim transcript validation test:

```javascript
// In interim-transcript-validation.spec.js
const sampleName = 'shopping-concierge-question';
```

The test will automatically:
1. Check for `shopping-concierge-question.wav` first
2. Use the pre-recorded audio if found
3. Fall back to TTS if the WAV file doesn't exist

### Verification

After adding the file, verify it works:

```bash
# Check if file exists
ls -lh test-app/public/audio-samples/shopping-concierge-question.wav

# Verify format (if you have ffprobe)
ffprobe shopping-concierge-question.wav
```

Expected output should show:
- Format: wav
- Sample rate: 16000 Hz
- Channels: 1 (mono)
- Bit depth: 16-bit

