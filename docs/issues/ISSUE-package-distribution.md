# Feature Request: Dual Format Package Distribution

## Problem
The current build system only produces ESM format (`dist/index.js`), but the module export validation test expects both CommonJS and ESM distributions for proper package distribution.

## Current State
- ✅ ESM build: `dist/index.js` (ESM format)
- ❌ CommonJS build: Missing
- ❌ Separate ESM build: Missing (`dist/index.esm.js`)
- ❌ Package.json configuration: Points to wrong files

## Requirements

### Build Output
- `dist/index.js` - CommonJS format for Node.js environments
- `dist/index.esm.js` - ESM format for modern bundlers
- `dist/index.d.ts` - TypeScript definitions
- `dist/types/` - Individual type definition files

### Package.json Configuration
```json
{
  "main": "dist/index.js",        // CommonJS entry
  "module": "dist/index.esm.js",  // ESM entry
  "types": "dist/index.d.ts"      // TypeScript definitions
}
```

### Rollup Configuration
Update `rollup.config.js` to build both formats:
```javascript
export default [
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named'
    }
  },
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm'
    }
  }
];
```

## Benefits
- ✅ Proper package distribution for npm publishing
- ✅ Support for both CommonJS and ESM environments
- ✅ Better compatibility with different bundlers
- ✅ Passes module export validation tests

## Priority
Medium - Required for proper package distribution but not blocking current voice-commerce integration

## Acceptance Criteria
- [ ] Build produces both CommonJS and ESM formats
- [ ] Package.json points to correct built files
- [ ] Module export validation tests pass
- [ ] TypeScript definitions are properly generated
- [ ] Package can be imported in both CommonJS and ESM environments
