# Recording Instructions for shopping-concierge-question.wav

## Option 1: Let it run for full duration (Recommended)

```bash
cd test-app/public/audio-samples
ffmpeg -f avfoundation -i ":0" -ar 16000 -ac 1 -sample_fmt s16 -t 5 shopping-concierge-question.wav
```

**Important:** 
- Speak your question: "Can you help me find a gift for my friend's birthday?"
- **Let it run for the full 5 seconds** - don't press Ctrl-C
- It will automatically stop after 5 seconds and save the file
- You can stop speaking after ~3.5 seconds, just let the timer finish

## Option 2: Manual stop (if you need more control)

```bash
cd test-app/public/audio-samples
ffmpeg -f avfoundation -i ":0" -ar 16000 -ac 1 -sample_fmt s16 shopping-concierge-question.wav
```

**Important:**
- Speak your question
- When done, press **`q`** (lowercase q) to quit gracefully
- Or press **`Ctrl-C`** once and wait for it to finish writing
- **Don't press Ctrl-C multiple times** - this can corrupt the file

## Option 3: Using Audacity (Easiest)

1. Open Audacity
2. Set sample rate to 16000 Hz (bottom left)
3. Set to Mono (click the dropdown next to the microphone icon)
4. Click Record, speak your question
5. Click Stop
6. File → Export → Export Audio
   - Format: WAV (Microsoft)
   - Encoding: 16-bit PCM
   - Sample Rate: 16000 Hz
   - Channels: Mono
7. Save as: `shopping-concierge-question.wav` in `test-app/public/audio-samples/`

## Verify the file

After recording, verify it was created:

```bash
cd test-app/public/audio-samples
ls -lh shopping-concierge-question.wav
ffprobe shopping-concierge-question.wav 2>&1 | grep -E "(Duration|Stream|Sample rate)"
```

Expected:
- File size: ~100-200 KB (for ~3-4 seconds)
- Sample rate: 16000 Hz
- Channels: 1 (mono)
- Format: wav

