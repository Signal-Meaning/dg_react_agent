#!/usr/bin/env node

/**
 * Local validation script for publish workflow authentication
 * Simulates the exact validation steps from .github/workflows/test-and-publish.yml
 * 
 * Usage:
 *   node scripts/validate-publish-auth.js
 *   
 * This uses your existing .npmrc file for authentication
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Publish Workflow Authentication Steps\n');
console.log('='.repeat(60));

// Read package.json to get version
let packageVersion;
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  packageVersion = packageJson.version;
  console.log(`\n📦 Package: ${packageJson.name}`);
  console.log(`📦 Version: ${packageVersion}`);
} catch (error) {
  console.error('❌ Failed to read package.json:', error.message);
  process.exit(1);
}

// Step 1: Verify npm configuration
console.log('\n' + '='.repeat(60));
console.log('STEP 1: Verify npm configuration');
console.log('='.repeat(60));

try {
  const defaultRegistry = execSync('npm config get registry', { encoding: 'utf8' }).trim();
  const scopeRegistry = execSync('npm config get @signal-meaning:registry', { encoding: 'utf8' }).trim();
  
  console.log('📋 Verifying npm configuration...');
  console.log(`   Default registry: ${defaultRegistry}`);
  console.log(`   Scope registry: ${scopeRegistry || '(not set)'}`);
  
  if (scopeRegistry !== 'https://npm.pkg.github.com') {
    console.log('⚠️  Warning: @signal-meaning:registry is not set to https://npm.pkg.github.com');
  } else {
    console.log('✅ Scope registry is correctly configured');
  }
  
  // Check .npmrc location
  const npmrcPath = execSync('npm config get userconfig', { encoding: 'utf8' }).trim();
  if (fs.existsSync(npmrcPath)) {
    console.log(`✅ npmrc file exists at: ${npmrcPath}`);
    
    // Show .npmrc content (masking tokens)
    const npmrcContent = fs.readFileSync(npmrcPath, 'utf8');
    const maskedContent = npmrcContent.replace(/(_authToken=)([^\s\n]+)/g, '$1***MASKED***');
    console.log('📄 npmrc content (masked):');
    console.log(maskedContent.split('\n').map(line => `   ${line}`).join('\n'));
  } else {
    console.log(`⚠️  npmrc file not found at expected location: ${npmrcPath}`);
  }
  
  // Also check project root .npmrc
  const projectNpmrc = path.join(process.cwd(), '.npmrc');
  if (fs.existsSync(projectNpmrc)) {
    console.log(`✅ Project .npmrc exists at: ${projectNpmrc}`);
  }
} catch (error) {
  console.error('❌ Failed to verify npm configuration:', error.message);
  process.exit(1);
}

// Step 2: Verify authentication
console.log('\n' + '='.repeat(60));
console.log('STEP 2: Verify authentication');
console.log('='.repeat(60));

try {
  console.log('🔐 Verifying authentication...');
  const whoami = execSync('npm whoami --registry https://npm.pkg.github.com', { 
    encoding: 'utf8',
    stdio: 'pipe'
  }).trim();
  
  console.log(`✅ Authentication successful`);
  console.log(`   Authenticated as: ${whoami}`);
} catch (error) {
  console.log('❌ Authentication verification failed');
  console.log('');
  console.log('Common causes:');
  console.log('  1. NPM_PACKAGES_TOKEN secret missing or invalid');
  console.log('  2. Token lacks \'write:packages\' permission');
  console.log('  3. Token lacks access to @signal-meaning organization');
  console.log('  4. Token expired');
  console.log('');
  console.log('Check your .npmrc file:');
  console.log('  - Ensure it contains: //npm.pkg.github.com/:_authToken=YOUR_TOKEN');
  console.log('  - Ensure it contains: @signal-meaning:registry=https://npm.pkg.github.com');
  console.log('');
  console.error('Error details:', error.message);
  process.exit(1);
}

// Step 3: Check if version already exists
console.log('\n' + '='.repeat(60));
console.log('STEP 3: Check if version already exists');
console.log('='.repeat(60));

try {
  console.log(`🔍 Checking if version ${packageVersion} already exists in registry...`);
  try {
    const viewOutput = execSync(
      `npm view @signal-meaning/deepgram-voice-interaction-react@${packageVersion} --registry https://npm.pkg.github.com`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    console.log(`⚠️  Version ${packageVersion} already exists in registry`);
    console.log('📄 Package info:');
    console.log(viewOutput);
  } catch (viewError) {
    if (viewError.message.includes('404') || viewError.message.includes('not found')) {
      console.log(`✅ Version ${packageVersion} does not exist, ready to publish`);
    } else {
      throw viewError;
    }
  }
} catch (error) {
  console.log(`⚠️  Could not check if version exists: ${error.message}`);
  console.log('   (This is not a blocker, continuing...)');
}

// Step 4: Test npm publish (dry-run)
console.log('\n' + '='.repeat(60));
console.log('STEP 4: Test npm publish (dry-run)');
console.log('='.repeat(60));

try {
  console.log('🧪 Running npm publish --dry-run...');
  const dryRunOutput = execSync('npm publish --dry-run', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  console.log('✅ Dry-run successful');
  console.log('📋 Dry-run output (last 30 lines):');
  const lines = dryRunOutput.split('\n');
  lines.slice(-30).forEach(line => {
    if (line.trim()) {
      console.log(`   ${line}`);
    }
  });
} catch (error) {
  console.log('❌ Dry-run failed');
  console.error('Error:', error.message);
  process.exit(1);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('✅ ALL VALIDATION STEPS PASSED');
console.log('='.repeat(60));
console.log(`\n📦 Ready to publish: ${packageVersion}`);
console.log('\n💡 To publish, run: npm publish');
console.log('   Or trigger the GitHub Actions workflow\n');

