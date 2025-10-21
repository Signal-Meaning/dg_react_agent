#!/usr/bin/env node

/**
 * Isolated test script for NPM_PACKAGES_TOKEN authentication
 * This script runs in a clean environment without contaminating your local setup
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 Testing NPM_PACKAGES_TOKEN authentication in isolated environment...\n');

// Check if NPM_PACKAGES_TOKEN is set
if (!process.env.NPM_PACKAGES_TOKEN) {
  console.log('❌ NPM_PACKAGES_TOKEN environment variable not set');
  console.log('💡 To test locally, set the token:');
  console.log('   export NPM_PACKAGES_TOKEN="your_token_here"');
  console.log('   node scripts/test-npm-token-isolated.js');
  process.exit(1);
}

console.log('✅ NPM_PACKAGES_TOKEN is set');

// Create a temporary directory for isolated testing
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-test-'));
console.log(`\n📁 Created isolated test directory: ${tempDir}`);

try {
  // Test 1: Check token format
  const token = process.env.NPM_PACKAGES_TOKEN;
  console.log(`\n🔑 Token format check:`);
  console.log(`   Length: ${token.length} characters`);
  console.log(`   Starts with: ${token.substring(0, 10)}...`);
  console.log(`   Ends with: ...${token.substring(token.length - 10)}`);

  // Test 2: Create isolated .npmrc
  console.log('\n📝 Creating isolated .npmrc configuration...');
  const npmrcPath = path.join(tempDir, '.npmrc');
  const npmrcContent = `//npm.pkg.github.com/:_authToken=${token}
@signal-meaning:registry=https://npm.pkg.github.com`;

  fs.writeFileSync(npmrcPath, npmrcContent);
  console.log('✅ Isolated .npmrc created');
  console.log('📄 .npmrc content:');
  console.log(npmrcContent);

  // Test 3: Test npm configuration in isolated environment
  console.log('\n🔧 Testing npm configuration in isolated environment...');
  try {
    const npmConfig = execSync('npm config list', { 
      encoding: 'utf8',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
    console.log('✅ npm config retrieved');
    console.log('📄 npm config:');
    console.log(npmConfig);
  } catch (error) {
    console.log('❌ Failed to get npm config:', error.message);
  }

  // Test 4: Test registry ping in isolated environment
  console.log('\n🏓 Testing registry ping in isolated environment...');
  try {
    const pingResult = execSync('npm ping --registry https://npm.pkg.github.com', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
    console.log('✅ Successfully pinged GitHub Package Registry');
    console.log(pingResult);
  } catch (pingError) {
    console.log('❌ Failed to ping GitHub Package Registry');
    console.log('Error:', pingError.message);
    console.log('This might indicate authentication issues');
  }

  // Test 5: Test package access in isolated environment
  console.log('\n📦 Testing package access in isolated environment...');
  try {
    const whoamiResult = execSync('npm whoami --registry https://npm.pkg.github.com', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
    console.log('✅ Successfully authenticated as:', whoamiResult.trim());
  } catch (whoamiError) {
    console.log('❌ Failed to authenticate with GitHub Package Registry');
    console.log('Error:', whoamiError.message);
    console.log('This confirms the authentication issue');
  }

  // Test 6: Test package view in isolated environment
  console.log('\n👀 Testing package view in isolated environment...');
  try {
    const viewResult = execSync('npm view @signal-meaning/deepgram-voice-interaction-react --registry https://npm.pkg.github.com', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
    console.log('✅ Successfully viewed package');
    console.log('📄 Package info:');
    console.log(viewResult);
  } catch (viewError) {
    console.log('❌ Failed to view package');
    console.log('Error:', viewError.message);
    console.log('This indicates package access issues');
  }

  // Test 7: Test package publishing (dry run) in isolated environment
  console.log('\n🚀 Testing package publishing (dry run) in isolated environment...');
  try {
    // Copy package files to temp directory
    console.log('   Copying package files to isolated environment...');
    execSync(`cp package.json package-lock.json ${tempDir}/`, { stdio: 'pipe' });
    execSync(`cp -r dist ${tempDir}/`, { stdio: 'pipe' });
    
    // Test publish with dry run in isolated environment
    console.log('   Testing publish with dry run in isolated environment...');
    const publishResult = execSync('npm publish --dry-run', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
    console.log('✅ Dry run successful in isolated environment');
    console.log('📄 Dry run output:');
    console.log(publishResult);
  } catch (publishError) {
    console.log('❌ Dry run failed in isolated environment');
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

} finally {
  // Cleanup: Remove temporary directory
  console.log('\n🧹 Cleaning up isolated environment...');
  try {
    execSync(`rm -rf ${tempDir}`, { stdio: 'pipe' });
    console.log('✅ Cleaned up isolated test directory');
  } catch (cleanupError) {
    console.log('⚠️  Could not clean up isolated test directory:', cleanupError.message);
    console.log(`   Manual cleanup: rm -rf ${tempDir}`);
  }
}

console.log('\n📋 Summary:');
console.log('This script tested NPM_PACKAGES_TOKEN in a completely isolated environment.');
console.log('No local files were modified or contaminated.');
console.log('\n💡 Next steps:');
console.log('1. If tests passed, the token works and we can update the workflows');
console.log('2. If tests failed, we need to check token permissions or create a new one');
console.log('3. Run the GitHub Actions workflows to verify the fix works in CI');
