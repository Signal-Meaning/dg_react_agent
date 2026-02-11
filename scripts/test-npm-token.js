#!/usr/bin/env node

/**
 * Local test script to test NPM_PACKAGES_TOKEN authentication
 * This simulates what the GitHub Action does with the updated token
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing NPM_PACKAGES_TOKEN authentication with GitHub Package Registry...\n');

// Check if NPM_PACKAGES_TOKEN is set
if (!process.env.NPM_PACKAGES_TOKEN) {
  console.log('❌ NPM_PACKAGES_TOKEN environment variable not set');
  console.log('💡 To test locally, set the token:');
  console.log('   export NPM_PACKAGES_TOKEN="your_token_here"');
  console.log('   node scripts/test-npm-token.js');
  process.exit(1);
}

console.log('✅ NPM_PACKAGES_TOKEN is set');

// Test 1: Check token format
const token = process.env.NPM_PACKAGES_TOKEN;
console.log(`\n🔑 Token format check:`);
console.log(`   Length: ${token.length} characters`);
console.log(`   Starts with: ${token.substring(0, 10)}...`);
console.log(`   Ends with: ...${token.substring(token.length - 10)}`);

// Test 2: Create .npmrc like the GitHub Action does
console.log('\n📝 Creating .npmrc configuration...');
const npmrcContent = `//npm.pkg.github.com/:_authToken=${token}
@signal-meaning:registry=https://npm.pkg.github.com`;

fs.writeFileSync('.npmrc', npmrcContent);
console.log('✅ .npmrc created');
console.log('📄 .npmrc content:');
console.log(npmrcContent);

// Test 3: Test npm configuration
console.log('\n🔧 Testing npm configuration...');
try {
  const npmConfig = execSync('npm config list', { encoding: 'utf8' });
  console.log('✅ npm config retrieved');
  console.log('📄 npm config:');
  console.log(npmConfig);
} catch (error) {
  console.log('❌ Failed to get npm config:', error.message);
}

// Test 4: Test registry ping
console.log('\n🏓 Testing registry ping...');
try {
  const pingResult = execSync('npm ping --registry https://npm.pkg.github.com', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✅ Successfully pinged GitHub Package Registry');
  console.log(pingResult);
} catch (pingError) {
  console.log('❌ Failed to ping GitHub Package Registry');
  console.log('Error:', pingError.message);
  console.log('This might indicate authentication issues');
}

// Test 5: Test package access
console.log('\n📦 Testing package access...');
try {
  const whoamiResult = execSync('npm whoami --registry https://npm.pkg.github.com', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✅ Successfully authenticated as:', whoamiResult.trim());
} catch (whoamiError) {
  console.log('❌ Failed to authenticate with GitHub Package Registry');
  console.log('Error:', whoamiError.message);
  console.log('This confirms the authentication issue');
}

// Test 6: Test package view
console.log('\n👀 Testing package view...');
try {
  const viewResult = execSync('npm view @signal-meaning/voice-agent-react --registry https://npm.pkg.github.com', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✅ Successfully viewed package');
  console.log('📄 Package info:');
  console.log(viewResult);
} catch (viewError) {
  console.log('❌ Failed to view package');
  console.log('Error:', viewError.message);
  console.log('This indicates package access issues');
}

// Test 7: Test package publishing (dry run) - THE KEY TEST
console.log('\n🚀 Testing package publishing (dry run)...');
try {
  // First, let's build the package
  console.log('   Building package...');
  execSync('npm run build', { stdio: 'pipe' });
  console.log('   ✅ Package built successfully');

  // Test publish with dry run
  console.log('   Testing publish with dry run...');
  const publishResult = execSync('npm publish --dry-run', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✅ Dry run successful');
  console.log('📄 Dry run output:');
  console.log(publishResult);
} catch (publishError) {
  console.log('❌ Dry run failed');
  console.log('Error:', publishError.message);
  console.log('This shows the actual publishing error');
}

// Test 8: Check token permissions
console.log('\n🔐 Checking token permissions...');
console.log('💡 To check if your token has the right permissions:');
console.log('   1. Go to https://github.com/settings/tokens');
console.log('   2. Find your NPM_PACKAGES_TOKEN');
console.log('   3. Verify it has these scopes:');
console.log('      - write:packages');
console.log('      - read:packages');
console.log('      - repo (if repository is private)');

// Cleanup
console.log('\n🧹 Cleaning up...');
try {
  fs.unlinkSync('.npmrc');
  console.log('✅ Cleaned up .npmrc file');
} catch (cleanupError) {
  console.log('⚠️  Could not clean up .npmrc file:', cleanupError.message);
}

console.log('\n📋 Summary:');
console.log('This script tests the same authentication steps that the GitHub Action performs.');
console.log('If any step fails, it indicates the issue with the NPM_PACKAGES_TOKEN.');
console.log('\n💡 Next steps:');
console.log('1. Verify the token has the correct permissions');
console.log('2. Check if the token is expired');
console.log('3. Ensure the token has access to the @signal-meaning organization');
