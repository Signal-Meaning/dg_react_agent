# Audio Samples for VAD Testing

This directory contains pre-recorded audio samples for VAD testing, complementing the TTS generation system.

## Directory Structure

```
tests/fixtures/audio-samples/
├── README.md                    # This file
├── samples.json                 # Sample configuration
├── hello.wav                    # Pre-recorded samples (optional)
├── wait-one-moment.wav
├── thank-you.wav
├── what-can-you-do.wav
├── greeting.wav
├── user-response.wav
├── barge-in.wav
├── short-response.wav
├── long-response.wav
└── confirmation.wav
```

## Audio File Requirements

### Format Specifications
- **Format**: WAV (uncompressed)
- **Sample Rate**: 16kHz (16000 Hz)
- **Channels**: Mono (1 channel)
- **Bit Depth**: 16-bit
- **Encoding**: Linear PCM

### Content Requirements
- **Duration**: 1-5 seconds of speech
- **Quality**: Clear, natural speech
- **Content**: Match the text in `samples.json`
- **Silence**: No silence padding (added automatically by the system)

## Creating Audio Samples

### Method 1: Using Audacity (Recommended)

1. **Install Audacity**: Download from [audacityteam.org](https://www.audacityteam.org/)

2. **Record Audio**:
   - Set sample rate to 16000 Hz
   - Set channels to Mono
   - Record your speech clearly
   - Keep it natural and conversational

3. **Export Settings**:
   - File → Export → Export Audio
   - Format: WAV (Microsoft)
   - Encoding: 16-bit PCM
   - Sample Rate: 16000 Hz
   - Channels: Mono

4. **Save to Directory**:
   - Save as `{sample-name}.wav` in this directory
   - Match the names in `samples.json`

### Method 2: Using FFmpeg

```bash
# Convert existing audio to required format
ffmpeg -i input.wav -ar 16000 -ac 1 -sample_fmt s16 output.wav

# Record directly with FFmpeg
ffmpeg -f avfoundation -i ":0" -ar 16000 -ac 1 -sample_fmt s16 -t 5 output.wav
```

### Method 3: Using Online Tools

1. **Record**: Use any online voice recorder
2. **Convert**: Use online WAV converter
3. **Verify**: Check format matches requirements

## Sample Configuration

The `samples.json` file defines the expected samples:

```json
{
  "hello": {
    "text": "Hello",
    "speechDuration": 1000,
    "onsetSilenceDuration": 300,
    "offsetSilenceDuration": 1000,
    "description": "Simple greeting"
  }
}
```

### Configuration Fields

- **text**: The spoken text (for TTS fallback)
- **speechDuration**: Expected speech duration in ms
- **onsetSilenceDuration**: Initial silence added by system (ms)
- **offsetSilenceDuration**: Ending silence added by system (ms)
- **description**: Human-readable description

## Usage in Tests

### Basic Usage
```javascript
// Use pre-recorded sample if available, fallback to TTS
await VADAudioSimulator.simulateSpeechWithSilence(page, 'hello', {
  sampleName: 'hello'
});
```

### Force Pre-recorded Audio
```javascript
// Only use pre-recorded audio, fail if not available
await VADAudioSimulator.simulateSpeechWithSilence(page, 'hello', {
  sampleName: 'hello',
  usePreRecorded: true
});
```

### Force TTS Generation
```javascript
// Skip pre-recorded files, use TTS only
await VADAudioSimulator.simulateSpeechWithSilence(page, 'hello', {
  sampleName: 'hello',
  usePreRecorded: false
});
```

## Quality Guidelines

### Speech Quality
- **Clarity**: Clear pronunciation, no mumbling
- **Pace**: Natural speaking pace (not too fast/slow)
- **Volume**: Consistent volume level
- **Environment**: Quiet background, no echo

### Content Guidelines
- **Natural**: Sound like natural conversation
- **Consistent**: Similar voice/accent across samples
- **Appropriate**: Match the intended use case
- **Professional**: Suitable for voice applications

## Testing Your Samples

### Validation Script
```bash
# Validate all audio files
node tests/utils/setup-audio-samples.js --validate

# Test specific sample
node tests/utils/setup-audio-samples.js --test-sample hello
```

### Manual Testing
```javascript
// Test in browser console
const loader = require('./audio-file-loader');
const validation = await loader.validateAudioFile('hello.wav');
console.log(validation);
```

## Troubleshooting

### Common Issues

1. **File Not Found**
   - Check filename matches `samples.json`
   - Verify file is in correct directory
   - Check file permissions

2. **Format Errors**
   - Verify WAV format (not MP3/other)
   - Check sample rate is 16000 Hz
   - Ensure mono channel

3. **Quality Issues**
   - Re-record with better microphone
   - Check background noise
   - Verify consistent volume

4. **VAD Not Triggering**
   - Check silence padding is sufficient
   - Verify audio content is clear
   - Test with different phrases

### Debug Commands

```bash
# List all samples
node tests/utils/setup-audio-samples.js --list

# Validate specific file
node -e "
const loader = require('./audio-file-loader');
loader.validateAudioFile('hello.wav').then(console.log);
"

# Test sample loading
node -e "
const simulator = require('./vad-audio-simulator');
simulator.loadAudioSample('hello').then(() => console.log('Success'));
"
```

## Best Practices

### For Voice Applications

1. **Professional Voice**: Use a professional voice actor if possible
2. **Consistent Branding**: Match your brand voice and tone
3. **Diverse Samples**: Include various user interaction patterns
4. **Regular Updates**: Refresh samples periodically
5. **Quality Control**: Test samples before committing

### For Development

1. **Version Control**: Keep samples in version control
2. **Documentation**: Document any special requirements
3. **Testing**: Test samples in different environments
4. **Backup**: Keep backups of original recordings
5. **Optimization**: Optimize file sizes for CI/CD

## Integration with CI/CD

### Automated Testing
```yaml
# GitHub Actions example
- name: Validate Audio Samples
  run: |
    node tests/utils/setup-audio-samples.js --validate
    node tests/utils/setup-audio-samples.js --test-all
```

### Pre-commit Hooks
```bash
# .git/hooks/pre-commit
#!/bin/sh
node tests/utils/setup-audio-samples.js --validate
```

## Future Enhancements

### Planned Features
- **Multiple Languages**: Support for different languages
- **Voice Variations**: Different voice options
- **Background Noise**: Optional background noise simulation
- **Emotion Variations**: Different emotional tones
- **Accent Support**: Various regional accents

### Contributing
- Follow the quality guidelines
- Test samples thoroughly
- Document any special requirements
- Submit samples via pull request
- Include validation results

## Support

For issues with audio samples:
1. Check this documentation
2. Run validation scripts
3. Test with TTS fallback
4. Create GitHub issue with details
5. Include sample file and error logs
