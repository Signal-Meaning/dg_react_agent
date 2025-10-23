# Technical Setup Guide

## Overview

This document covers the technical requirements and build configuration needed to integrate the `@signal-meaning/deepgram-voice-interaction-react` component. For usage patterns and examples, see [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md).

## Plugin Requirements

### 1. React Externalization (CRITICAL)
- ✅ React and React-DOM MUST be externalized (not bundled)
- ✅ Plugin uses peer dependencies for React
- ✅ Plugin does NOT include React in dependencies
- ✅ Rollup config externalizes 'react' and 'react-dom'

### 2. Build Configuration
- ✅ Provides both ESM and CJS builds
- ✅ Proper external configuration in rollup
- ✅ Validates before and after build

### 3. Package.json Requirements
- ✅ Has peerDependencies for react and react-dom
- ✅ Does NOT have react or react-dom in dependencies
- ✅ Provides both main and module fields

## Integration Validation

The plugin includes a built-in validator that ensures:
- React is properly externalized
- No React bundling in the plugin
- Proper peer dependencies configuration
- Compatible with single React instance

## Developer Integration Guide

### Step 1: Install the Package
```bash
npm install @signal-meaning/deepgram-voice-interaction-react
```

### Step 2: Ensure React Version Compatibility
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

### Step 3: Configure Webpack Aliases (CRITICAL)
```javascript
// webpack.config.js or craco.config.js
module.exports = {
  resolve: {
    alias: {
      'react': 'react',
      'react-dom': 'react-dom'
    }
  }
};
```

### Step 4: Use the Component
```tsx
import React from 'react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function App() {
  return (
    <DeepgramVoiceInteraction
      apiKey="your-api-key"
      onTranscriptUpdate={(result) => console.log(result)}
      onAgentUtterance={(utterance) => console.log(utterance)}
    />
  );
}
```

> **Note**: For complete usage examples and patterns, see [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md)

## Error Prevention

### Common Issues and Solutions

#### 1. "Invalid hook call" Error
**Cause**: Multiple React instances
**Solution**: Use webpack aliases to ensure single React instance

#### 2. "Cannot find module" Error
**Cause**: Plugin not properly externalized
**Solution**: Run `npm run validate` in the plugin directory

#### 3. React Hooks Errors
**Cause**: Plugin bundling React instead of externalizing
**Solution**: Check rollup configuration and rebuild

## Validation Commands

### Validate Plugin Before Integration
```bash
cd node_modules/deepgram-voice-interaction-react
npm run validate
```

### Validate After Integration
```bash
# Check for React hooks errors in browser console
# Monitor for "Invalid hook call" errors
```

## Testing Integration

### Unit Tests
```tsx
import { render } from '@testing-library/react';
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

test('should render without React hooks errors', () => {
  render(<DeepgramVoiceInteraction apiKey="test" />);
  // No "Invalid hook call" errors should occur
});
```

### E2E Tests
```javascript
// playwright test
test('should work without React hooks errors', async ({ page }) => {
  await page.goto('/');
  // Check for error messages in console
  const errors = await page.evaluate(() => {
    return window.console.errors.filter(e => 
      e.includes('Invalid hook call') || 
      e.includes('dispatcher.useMemo')
    );
  });
  expect(errors).toHaveLength(0);
});
```

## Troubleshooting

### 1. Package Validation Fails
```bash
# Check rollup configuration
cat rollup.config.js | grep -A 5 "external"

# Verify peer dependencies
cat package.json | grep -A 5 "peerDependencies"

# Rebuild package
npm run build
```

### 2. Integration Still Has Errors
```bash
# Check webpack aliases
cat webpack.config.js | grep -A 5 "alias"

# Verify single React instance
npm ls react
```

### 3. Runtime Errors
- Check browser console for "Invalid hook call" errors
- Monitor for React hooks errors during development
- Verify webpack aliases are working

## Best Practices

1. **Always validate the package** before integration
2. **Use webpack aliases** to ensure single React instance
3. **Monitor for React hooks errors** during development
4. **Test integration** with both unit and E2E tests
5. **Check browser console** for React hooks errors in production

## Support

If you encounter issues:
1. Run `npm run validate` in the package directory
2. Check webpack aliases configuration
3. Verify React version compatibility
4. Check browser console for specific error messages
5. See [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) for usage patterns and examples
6. See [API-REFERENCE.md](./API-REFERENCE.md) for complete component API documentation

## Changelog

### v0.4.0+
- Updated package name to @signal-meaning/deepgram-voice-interaction-react
- Removed outdated HealthMonitor references
- Focused on technical setup and build configuration
- Added cross-references to comprehensive integration guide

