# API Changes - v0.4.0

## Overview

This release contains **no breaking changes** to the public API. All existing APIs remain unchanged and backward compatible.

## Component Props

### No Changes
- All existing component props remain unchanged
- No new props added
- No props removed or deprecated

## Callback Functions

### No Changes
- All existing callback functions remain unchanged
- No new callbacks added
- No callbacks removed or deprecated

## State Interface

### No Changes
- All existing state properties remain unchanged
- No new state properties added
- No state properties removed or deprecated

## Methods

### No Changes
- All existing methods remain unchanged
- No new methods added
- No methods removed or deprecated

## Types

### No Changes
- All existing TypeScript types remain unchanged
- No new types added
- No types removed or deprecated

## Internal Changes

### Test Infrastructure
- **AudioManager Mock**: Added `setTtsMuted` method to test mocks
- **Mock Consistency**: Standardized mock implementations across test files
- **Test Coverage**: Enhanced test coverage for AudioManager functionality

### Build Process
- **Dependencies**: Updated 12 packages to latest versions
- **Validation**: Enhanced package validation process
- **Build Pipeline**: Improved build and packaging process

### Documentation
- **Release Process**: Added comprehensive release checklist
- **Documentation Standards**: Established documentation structure
- **Issue Templates**: Added GitHub issue template for releases

## Migration Guide

### No Migration Required
Since there are no breaking changes, no migration is required:

```typescript
// ✅ Existing code continues to work unchanged
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

### What's New
- Enhanced release process documentation
- Improved test coverage and reliability
- Better development workflow tools
- Comprehensive documentation standards

## Compatibility

### React Versions
- **React 16.8.0+**: Fully supported
- **React 17.x**: Fully supported
- **React 18.x**: Fully supported

### TypeScript
- **TypeScript 4.7+**: Fully supported
- **TypeScript 5.x**: Fully supported

### Node.js
- **Node.js 16+**: Fully supported
- **Node.js 18+**: Fully supported
- **Node.js 20+**: Fully supported

## Testing

### Test Coverage
- **Unit Tests**: Enhanced AudioManager mock coverage
- **Integration Tests**: Improved test reliability
- **E2E Tests**: All existing tests continue to pass

### Mock Updates
```typescript
// Updated AudioManager mock includes setTtsMuted method
AudioManager.mockImplementation(() => ({
  initialize: jest.fn().mockResolvedValue(),
  startRecording: jest.fn().mockResolvedValue(),
  stopRecording: jest.fn(),
  addEventListener: jest.fn().mockReturnValue(mockUnsubscribe),
  dispose: jest.fn(),
  setTtsMuted: jest.fn() // ✅ Added in v0.4.0
}));
```

## Support

For questions about API changes:

- **GitHub Issues**: [Create an issue](https://github.com/Signal-Meaning/dg_react_agent/issues)
- **Documentation**: Check the [release documentation](./README.md)
- **Migration Guide**: See [migration documentation](../../migration/README.md)

---

**Next Steps**: See [EXAMPLES.md](./EXAMPLES.md) for usage examples and [MIGRATION.md](./MIGRATION.md) for migration guidance.
