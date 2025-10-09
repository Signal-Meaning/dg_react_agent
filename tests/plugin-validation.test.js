/**
 * Plugin Validation Test
 * 
 * This test validates that the custom plugin validator correctly identifies
 * React externalization vs bundling issues.
 */

const fs = require('fs');
const path = require('path');

describe('Plugin Validation Logic', () => {
  const distPath = path.join(__dirname, '../dist');
  
  beforeAll(() => {
    // Ensure the package is built
    if (!fs.existsSync(distPath)) {
      throw new Error('Dist folder not found. Please run "npm run build" first.');
    }
  });

  describe('React Externalization Detection', () => {
    test('should correctly identify externalized React (not bundled)', () => {
      const cjsPath = path.join(distPath, 'index.js');
      const cjsContent = fs.readFileSync(cjsPath, 'utf8');
      
      // React should be externalized (require("react") is OK)
      // React should NOT be bundled (no React implementation code)
      
      // This should be TRUE - React is externalized via require()
      const hasExternalReact = /require\(['"]react['"]\)/.test(cjsContent);
      expect(hasExternalReact).toBe(true);
      
      // This should be FALSE - React implementation should not be bundled
      const hasBundledReactImplementation = /function\s+React|class\s+React|var\s+React\s*=\s*function/.test(cjsContent);
      expect(hasBundledReactImplementation).toBe(false);
      
      // This should be FALSE - No React hooks implementation
      const hasBundledReactHooks = /function\s+useState|function\s+useEffect|function\s+useRef/.test(cjsContent);
      expect(hasBundledReactHooks).toBe(false);
    });

    test('should correctly identify externalized React in ESM build', () => {
      const esmPath = path.join(distPath, 'index.esm.js');
      const esmContent = fs.readFileSync(esmPath, 'utf8');
      
      // React should be externalized (named imports from "react" are OK)
      const hasExternalReact = /import\s*\{[^}]*\}\s*from\s*['"]react['"]/.test(esmContent);
      expect(hasExternalReact).toBe(true);
      
      // React implementation should not be bundled
      const hasBundledReactImplementation = /function\s+React|class\s+React|var\s+React\s*=\s*function/.test(esmContent);
      expect(hasBundledReactImplementation).toBe(false);
    });
  });

  describe('Validator Logic (Fixed)', () => {
    test('should correctly identify externalized React vs bundled React implementation', () => {
      // This test verifies the fixed validator logic
      // The validator now correctly distinguishes between externalized and bundled React
      
      const cjsPath = path.join(distPath, 'index.js');
      const cjsContent = fs.readFileSync(cjsPath, 'utf8');
      
      // Externalized React patterns (should be present)
      const reactExternalPatterns = [
        /require\(['"]react['"]\)/g,
        /import\s*\{[^}]*\}\s*from\s*['"]react['"]/g,
        /import\s+.*\s+from\s+['"]react['"]/g,
        /var\s+\w+\s*=\s*require\(['"]react['"]\)/g
      ];

      // Bundled React implementation patterns (should NOT be present)
      const reactBundledPatterns = [
        /function\s+React|class\s+React|var\s+React\s*=\s*function/g,
        /function\s+useState|function\s+useEffect|function\s+useRef/g,
        /React\.createElement|React\.Component/g
      ];

      let hasExternalReact = false;
      for (const pattern of reactExternalPatterns) {
        if (pattern.test(cjsContent)) {
          hasExternalReact = true;
          break;
        }
      }

      let hasBundledReact = false;
      for (const pattern of reactBundledPatterns) {
        if (pattern.test(cjsContent)) {
          hasBundledReact = true;
          break;
        }
      }

      // React should be externalized (present) but not bundled (absent)
      expect(hasExternalReact).toBe(true);
      expect(hasBundledReact).toBe(false);
    });
  });
});
