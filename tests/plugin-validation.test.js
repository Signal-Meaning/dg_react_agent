/**
 * Plugin Validation Test
 *
 * Validates that React is externalized (not bundled) in the built output.
 * Uses intent-based checks so the test does not break when the build format
 * changes (e.g. minification, default vs named imports, quote style).
 */

const fs = require('fs');
const path = require('path');

describe('Plugin Validation Logic', () => {
  const distPath = path.join(__dirname, '../dist');

  beforeAll(() => {
    if (!fs.existsSync(distPath)) {
      throw new Error('Dist folder not found. Please run "npm run build" first.');
    }
  });

  /**
   * React is "externalized" if the bundle references the module "react" as a dependency
   * (require or import from "react") rather than inlining its implementation.
   * These patterns are resilient to minification and import style (default, named, mixed).
   */
  function reactIsReferencedAsExternal(content, format) {
    if (format === 'cjs') {
      // require("react") or require('react') — minified may have no spaces
      return /\brequire\s*\(\s*['"]react['"]\s*\)/.test(content);
    }
    if (format === 'esm') {
      // Any ESM import from "react" or 'react' — e.g. import x from "react" or import {y} from "react"
      // Minified can be }from"react" with no space
      return /\bfrom\s*['"]react['"]/.test(content);
    }
    return false;
  }

  /**
   * React is "bundled" if the build contains React's own implementation (runtime/hooks).
   * We should not ship that; the consumer provides React.
   */
  function reactImplementationIsBundled(content) {
    const bundledPatterns = [
      /function\s+React\b|class\s+React\b|var\s+React\s*=\s*function/,
      /\bfunction\s+useState\b|\bfunction\s+useEffect\b|\bfunction\s+useRef\b/,
      /\bReact\.createElement\b|\bReact\.Component\b/,
    ];
    return bundledPatterns.some((p) => p.test(content));
  }

  describe('React Externalization Detection', () => {
    test('CJS build: React is externalized and not bundled', () => {
      const cjsPath = path.join(distPath, 'index.js');
      const content = fs.readFileSync(cjsPath, 'utf8');

      expect(reactIsReferencedAsExternal(content, 'cjs')).toBe(true);
      expect(reactImplementationIsBundled(content)).toBe(false);
    });

    test('ESM build: React is externalized and not bundled', () => {
      const esmPath = path.join(distPath, 'index.esm.js');
      const content = fs.readFileSync(esmPath, 'utf8');

      expect(reactIsReferencedAsExternal(content, 'esm')).toBe(true);
      expect(reactImplementationIsBundled(content)).toBe(false);
    });
  });

  describe('Validator Logic (Fixed)', () => {
    test('CJS: external reference present and no bundled React implementation', () => {
      const cjsPath = path.join(distPath, 'index.js');
      const content = fs.readFileSync(cjsPath, 'utf8');

      expect(reactIsReferencedAsExternal(content, 'cjs')).toBe(true);
      expect(reactImplementationIsBundled(content)).toBe(false);
    });
  });
});
