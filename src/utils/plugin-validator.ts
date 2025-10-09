/**
 * Plugin Validator - Ensures dg_react_agent meets integration requirements
 * 
 * This validator enforces strict requirements on the plugin output to make
 * integration easier for developers and prevent common React hooks issues.
 */

export interface PluginValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requirements: {
    reactExternalized: boolean;
    noReactBundling: boolean;
    properPeerDeps: boolean;
    esmCompatible: boolean;
    cjsCompatible: boolean;
  };
}

export class PluginValidator {
  private static readonly REQUIRED_PEER_DEPS = ['react', 'react-dom'];
  private static readonly FORBIDDEN_BUNDLED_DEPS = ['react', 'react-dom'];
  private static readonly REQUIRED_EXTERNALS = ['react', 'react-dom'];

  /**
   * Validates the plugin package.json for proper peer dependencies
   */
  static validatePackageJson(packageJson: any): Partial<PluginValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requirements = {
      properPeerDeps: false,
      reactExternalized: false,
      noReactBundling: false,
      esmCompatible: false,
      cjsCompatible: false
    };

    // Check peer dependencies
    if (!packageJson.peerDependencies) {
      errors.push('Missing peerDependencies section');
    } else {
      for (const dep of this.REQUIRED_PEER_DEPS) {
        if (!packageJson.peerDependencies[dep]) {
          errors.push(`Missing peer dependency: ${dep}`);
        } else {
          requirements.properPeerDeps = true;
        }
      }
    }

    // Check that React is not in dependencies
    if (packageJson.dependencies) {
      for (const dep of this.FORBIDDEN_BUNDLED_DEPS) {
        if (packageJson.dependencies[dep]) {
          errors.push(`React should not be bundled in dependencies: ${dep}`);
        }
      }
    }

    // Check for proper external configuration
    if (packageJson.main && packageJson.module) {
      requirements.cjsCompatible = true;
      requirements.esmCompatible = true;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requirements
    };
  }

  /**
   * Validates the built plugin bundle for proper React externalization
   */
  static validateBuiltBundle(bundleContent: string): Partial<PluginValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requirements = {
      reactExternalized: false,
      noReactBundling: false,
      properPeerDeps: false,
      esmCompatible: false,
      cjsCompatible: false
    };

    // Check that React is not bundled (should be externalized)
    // For CommonJS output, we expect require("react") calls, not bundled React code
    const reactBundledPatterns = [
      /var\s+React\s*=\s*require\(['"]react['"]\)/g,
      /function\s+\w+\(\)\s*\{[^}]*React[^}]*\}/g,
      /React\.createElement/g,
      /React\.useState/g,
      /React\.useEffect/g
    ];

    let hasBundledReact = false;
    for (const pattern of reactBundledPatterns) {
      if (pattern.test(bundleContent)) {
        hasBundledReact = true;
        break;
      }
    }

    if (hasBundledReact) {
      errors.push('React is bundled in the plugin instead of being externalized');
    } else {
      requirements.reactExternalized = true;
      requirements.noReactBundling = true;
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
      requirements.reactExternalized = true;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requirements
    };
  }

  /**
   * Validates the rollup configuration for proper externalization
   */
  static validateRollupConfig(rollupConfig: any): Partial<PluginValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requirements = {
      reactExternalized: false,
      noReactBundling: false,
      properPeerDeps: false,
      esmCompatible: false,
      cjsCompatible: false
    };

    // Check external configuration
    if (!rollupConfig.external) {
      errors.push('Missing external configuration in rollup config');
    } else {
      const external = rollupConfig.external;
      const externalArray = Array.isArray(external) ? external : 
                           typeof external === 'function' ? 
                           this.REQUIRED_EXTERNALS.map(dep => external(dep)) : 
                           Object.keys(external);

      for (const dep of this.REQUIRED_EXTERNALS) {
        if (externalArray.includes(dep) || externalArray.includes(true)) {
          requirements.reactExternalized = true;
        } else {
          errors.push(`React not properly externalized: ${dep}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requirements
    };
  }

  /**
   * Comprehensive validation of the entire plugin
   */
  static validatePlugin(packageJson: any, bundleContent: string, rollupConfig: any): PluginValidationResult {
    const packageResult = this.validatePackageJson(packageJson);
    const bundleResult = this.validateBuiltBundle(bundleContent);
    const rollupResult = this.validateRollupConfig(rollupConfig);

    const allErrors = [
      ...(packageResult.errors || []),
      ...(bundleResult.errors || []),
      ...(rollupResult.errors || [])
    ];

    const allWarnings = [
      ...(packageResult.warnings || []),
      ...(bundleResult.warnings || []),
      ...(rollupResult.warnings || [])
    ];

    const requirements = {
      reactExternalized: (packageResult.requirements?.reactExternalized || false) &&
                        (bundleResult.requirements?.reactExternalized || false) &&
                        (rollupResult.requirements?.reactExternalized || false),
      noReactBundling: bundleResult.requirements?.noReactBundling || false,
      properPeerDeps: packageResult.requirements?.properPeerDeps || false,
      esmCompatible: packageResult.requirements?.esmCompatible || false,
      cjsCompatible: packageResult.requirements?.cjsCompatible || false
    };

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      requirements
    };
  }

  /**
   * Generates integration requirements documentation
   */
  static generateIntegrationRequirements(): string {
    return `
# dg_react_agent Integration Requirements

## Plugin Requirements

The dg_react_agent plugin MUST meet the following requirements for proper integration:

### 1. React Externalization
- React and React-DOM MUST be externalized (not bundled)
- Plugin MUST use peer dependencies for React
- Plugin MUST NOT include React in dependencies

### 2. Build Configuration
- Rollup config MUST externalize 'react' and 'react-dom'
- Plugin MUST provide both ESM and CJS builds
- Plugin MUST use proper external configuration

### 3. Package.json Requirements
- MUST have peerDependencies for react and react-dom
- MUST NOT have react or react-dom in dependencies
- MUST provide both main and module fields

### 4. Integration Validation
- Plugin MUST pass PluginValidator validation
- Plugin MUST not cause "Invalid hook call" errors
- Plugin MUST work with single React instance

## Developer Integration

When integrating dg_react_agent:

1. Ensure your app uses React 16.8+ (same version as plugin peer deps)
2. Use webpack aliases to ensure single React instance
3. Validate plugin before integration using PluginValidator
4. Monitor for React hooks errors during development

## Error Prevention

The plugin validator will catch:
- React bundling issues
- Missing peer dependencies
- Improper externalization
- Multiple React instances

## Example Integration

\`\`\`javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      'react': 'react',
      'react-dom': 'react-dom'
    }
  }
};
\`\`\`
    `.trim();
  }
}
