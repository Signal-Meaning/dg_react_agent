#!/usr/bin/env node

/**
 * Plugin Validation Script
 * 
 * This script validates that the dg_react_agent plugin meets all integration
 * requirements before building. It enforces strict requirements to prevent
 * React hooks errors and make integration easier for developers.
 */

const fs = require('fs');
const path = require('path');

class PluginValidator {
  static validatePackageJson() {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const errors = [];
    const warnings = [];

    console.log('🔍 Validating package.json...');

    // Check peer dependencies
    if (!packageJson.peerDependencies) {
      errors.push('❌ Missing peerDependencies section');
    } else {
      const requiredDeps = ['react', 'react-dom'];
      for (const dep of requiredDeps) {
        if (!packageJson.peerDependencies[dep]) {
          errors.push(`❌ Missing peer dependency: ${dep}`);
        } else {
          console.log(`✅ Peer dependency found: ${dep}`);
        }
      }
    }

    // Check that React is not in dependencies
    if (packageJson.dependencies) {
      const forbiddenDeps = ['react', 'react-dom'];
      for (const dep of forbiddenDeps) {
        if (packageJson.dependencies[dep]) {
          errors.push(`❌ React should not be bundled in dependencies: ${dep}`);
        }
      }
    }

    // Check for proper build outputs
    if (!packageJson.main) {
      errors.push('❌ Missing main field for CJS build');
    } else {
      console.log('✅ CJS build configured');
    }

    if (!packageJson.module) {
      errors.push('❌ Missing module field for ESM build');
    } else {
      console.log('✅ ESM build configured');
    }

    return { errors, warnings };
  }

  static validateRollupConfig() {
    const rollupPath = path.join(__dirname, '..', 'rollup.config.js');
    const errors = [];
    const warnings = [];

    console.log('🔍 Validating rollup.config.js...');

    if (!fs.existsSync(rollupPath)) {
      errors.push('❌ Missing rollup.config.js');
      return { errors, warnings };
    }

    const rollupContent = fs.readFileSync(rollupPath, 'utf8');

    // Check for external configuration (function-based or object-based)
    const hasExternalConfig = rollupContent.includes('external:') || 
                             rollupContent.includes('external,') ||
                             rollupContent.includes('external');
    if (!hasExternalConfig) {
      errors.push('❌ Missing external configuration in rollup config');
    } else {
      console.log('✅ External configuration found');
    }

    // Check for React externalization
    if (!rollupContent.includes("'react'") || !rollupContent.includes("'react-dom'")) {
      errors.push('❌ React not properly externalized in rollup config');
    } else {
      console.log('✅ React externalization configured');
    }

    return { errors, warnings };
  }

  static validateBuiltBundle() {
    const distPath = path.join(__dirname, '..', 'dist', 'index.js');
    const errors = [];
    const warnings = [];

    console.log('🔍 Validating built bundle...');

    if (!fs.existsSync(distPath)) {
      errors.push('❌ Built bundle not found. Run npm run build first.');
      return { errors, warnings };
    }

    const bundleContent = fs.readFileSync(distPath, 'utf8');

    // Check that React is properly externalized (not bundled)
    const reactExternalPatterns = [
      /require\(['"]react['"]\)/g,
      /import\s*\{[^}]*\}\s*from\s*['"]react['"]/g,
      /import\s+.*\s+from\s+['"]react['"]/g,
      /var\s+\w+\s*=\s*require\(['"]react['"]\)/g
    ];

    // Check for actual React implementation being bundled (bad)
    const reactBundledPatterns = [
      /function\s+React|class\s+React|var\s+React\s*=\s*function/g,
      /function\s+useState|function\s+useEffect|function\s+useRef/g,
      /React\.createElement|React\.Component/g
    ];

    let hasExternalReact = false;
    for (const pattern of reactExternalPatterns) {
      if (pattern.test(bundleContent)) {
        hasExternalReact = true;
        break;
      }
    }

    let hasBundledReact = false;
    for (const pattern of reactBundledPatterns) {
      if (pattern.test(bundleContent)) {
        hasBundledReact = true;
        break;
      }
    }

    if (hasBundledReact) {
      errors.push('❌ React implementation is bundled in the plugin instead of being externalized');
    } else if (hasExternalReact) {
      console.log('✅ React properly externalized in bundle');
    } else {
      warnings.push('⚠️ No React references found - may indicate bundling issue');
    }

    // Check for proper external references
    const externalRefPatterns = [
      /require\(['"]react['"]\)/g,
      /import\s+.*\s+from\s+['"]react['"]/g
    ];

    let hasExternalRefs = false;
    for (const pattern of externalRefPatterns) {
      if (pattern.test(bundleContent)) {
        hasExternalRefs = true;
        break;
      }
    }

    if (hasExternalRefs) {
      console.log('✅ External React references found');
    } else {
      warnings.push('⚠️ No external React references found - may indicate bundling issue');
    }

    return { errors, warnings };
  }

  static validatePlugin() {
    console.log('🚀 Starting dg_react_agent plugin validation...\n');

    const packageResult = this.validatePackageJson();
    const rollupResult = this.validateRollupConfig();
    const bundleResult = this.validateBuiltBundle();

    const allErrors = [
      ...packageResult.errors,
      ...rollupResult.errors,
      ...bundleResult.errors
    ];

    const allWarnings = [
      ...packageResult.warnings,
      ...rollupResult.warnings,
      ...bundleResult.warnings
    ];

    console.log('\n📊 Validation Results:');

    if (allErrors.length === 0) {
      console.log('✅ Plugin validation PASSED');
      console.log('✅ Plugin meets all integration requirements');
      console.log('✅ Safe for integration with React applications');
    } else {
      console.log('❌ Plugin validation FAILED');
      console.log('\nErrors:');
      allErrors.forEach(error => console.log(`  ${error}`));
    }

    if (allWarnings.length > 0) {
      console.log('\nWarnings:');
      allWarnings.forEach(warning => console.log(`  ${warning}`));
    }

    if (allErrors.length > 0) {
      console.log('\n🔧 Fix these issues before building:');
      console.log('1. Ensure React is properly externalized in rollup config');
      console.log('2. Verify peer dependencies are correctly configured');
      console.log('3. Check that React is not bundled in the output');
      console.log('4. Run npm run build after fixing issues');
      
      process.exit(1);
    }

    console.log('\n🎉 Plugin is ready for integration!');
  }
}

// Run validation
PluginValidator.validatePlugin();
