# Migration Guide - v0.4.0

## Overview

This is a **minor version release** with **no breaking changes**. No migration is required for existing applications.

## Breaking Changes

### None
- ✅ No breaking changes in this release
- ✅ All existing APIs remain unchanged
- ✅ Backward compatible with all previous versions

## Deprecated Features

### None
- ✅ No features deprecated in this release
- ✅ All existing features remain supported

## API Changes

### None
- ✅ No API changes in this release
- ✅ All existing APIs remain unchanged

## Configuration Changes

### None
- ✅ No configuration changes required
- ✅ All existing configurations remain valid

## Code Examples

### Before (v0.3.x)
```typescript
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

const MyComponent = () => {
  return (
    <DeepgramVoiceInteraction
      apiKey="your-api-key"
      agentOptions={{
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.'
      }}
      onReady={() => console.log('Ready')}
      onError={(error) => console.error('Error:', error)}
    />
  );
};
```

### After (v0.4.0)
```typescript
// ✅ No changes required - same code works unchanged
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

const MyComponent = () => {
  return (
    <DeepgramVoiceInteraction
      apiKey="your-api-key"
      agentOptions={{
        language: 'en',
        listenModel: 'nova-2',
        thinkProviderType: 'open_ai',
        thinkModel: 'gpt-4o-mini',
        voice: 'aura-asteria-en',
        instructions: 'You are a helpful assistant.'
      }}
      onReady={() => console.log('Ready')}
      onError={(error) => console.error('Error:', error)}
    />
  );
};
```

## Installation

### Update Package
```bash
# Update to v0.4.0
npm install @signal-meaning/deepgram-voice-interaction-react@0.4.0

# Or update to latest
npm install @signal-meaning/deepgram-voice-interaction-react@latest
```

### Verify Installation
```bash
# Check installed version
npm list @signal-meaning/deepgram-voice-interaction-react

# Should show version 0.4.0
```

## Testing

### Update Tests (Optional)
If you have custom tests that mock AudioManager, you may want to update them to include the `setTtsMuted` method:

```typescript
// Optional: Update AudioManager mocks
const mockAudioManager = {
  initialize: jest.fn().mockResolvedValue(),
  startRecording: jest.fn().mockResolvedValue(),
  stopRecording: jest.fn(),
  addEventListener: jest.fn().mockReturnValue(() => {}),
  dispose: jest.fn(),
  setTtsMuted: jest.fn() // ✅ Added in v0.4.0
};
```

### Run Tests
```bash
# Run your existing tests
npm test

# All tests should continue to pass
```

## What's New

### Enhanced Release Process
- Comprehensive release checklist
- GitHub issue template for releases
- Documentation standards

### Improved Testing
- Enhanced AudioManager mock coverage
- Better test reliability
- Standardized mock implementations

### Better Documentation
- Comprehensive release documentation
- Migration guides for all versions
- Usage examples and best practices

## Common Issues

### None Expected
Since there are no breaking changes, no common issues are expected.

### If You Encounter Issues
1. **Check Version**: Ensure you're using v0.4.0
2. **Clear Cache**: Clear npm cache and node_modules
3. **Reinstall**: Reinstall the package
4. **Check Documentation**: Review the [release documentation](./README.md)

## Rollback

### If Needed
If you need to rollback to a previous version:

```bash
# Rollback to v0.3.2
npm install @signal-meaning/deepgram-voice-interaction-react@0.3.2

# Rollback to v0.3.1
npm install @signal-meaning/deepgram-voice-interaction-react@0.3.1
```

### No Code Changes Required
Since there are no breaking changes, no code changes are required when rolling back.

## Support

### Getting Help
- **GitHub Issues**: [Create an issue](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Check the [release documentation](./README.md)
- **Migration Guide**: See [migration documentation](../../migration/README.md)

### Reporting Issues
When reporting issues:
1. Include version information (v0.4.0)
2. Provide complete error messages
3. Include relevant code examples
4. Describe steps to reproduce

---

**Next Steps**: See [EXAMPLES.md](./EXAMPLES.md) for usage examples and [NEW-FEATURES.md](./NEW-FEATURES.md) for new features.
