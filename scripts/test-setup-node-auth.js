#!/usr/bin/env node

/**
 * Test script to simulate what setup-node action does with NPM_PACKAGES_TOKEN
 * This helps debug why GitHub Actions fails but local testing works
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 Testing setup-node action behavior with NPM_PACKAGES_TOKEN...\n');

// Check if NPM_PACKAGES_TOKEN is set
if (!process.env.NPM_PACKAGES_TOKEN) {
  console.log('❌ NPM_PACKAGES_TOKEN environment variable not set');
  console.log('💡 To test locally, set the token:');
  console.log('   export NPM_PACKAGES_TOKEN="your_token_here"');
  console.log('   node scripts/test-setup-node-auth.js');
  process.exit(1);
}

console.log('✅ NPM_PACKAGES_TOKEN is set');

// Create a temporary directory for isolated testing
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-node-test-'));
console.log(`📁 Created isolated test directory: ${tempDir}`);

try {
  const token = process.env.NPM_PACKAGES_TOKEN;
  
  // Test 1: Simulate what setup-node does
  console.log('\n=== Simulating setup-node action ===');
  
  // setup-node sets NODE_AUTH_TOKEN environment variable
  const nodeAuthToken = token;
  console.log(`NODE_AUTH_TOKEN: ${nodeAuthToken.substring(0, 10)}...`);
  
  // setup-node creates .npmrc in the temp directory
  const npmrcPath = path.join(tempDir, '.npmrc');
  const npmrcContent = `//npm.pkg.github.com/:_authToken=${nodeAuthToken}
@signal-meaning:registry=https://npm.pkg.github.com
always-auth=true`;

  fs.writeFileSync(npmrcPath, npmrcContent);
  console.log('📄 .npmrc created by setup-node:');
  console.log(npmrcContent);

  // Test 2: Check what npm config shows
  console.log('\n=== NPM Configuration (setup-node style) ===');
  try {
    const npmConfig = execSync('npm config list', { 
      encoding: 'utf8',
      cwd: tempDir,
      env: { 
        ...process.env, 
        NPM_CONFIG_USERCONFIG: npmrcPath,
        NODE_AUTH_TOKEN: nodeAuthToken
      }
    });
    console.log('📄 npm config:');
    console.log(npmConfig);
  } catch (error) {
    console.log('❌ Failed to get npm config:', error.message);
  }

  // Test 3: Test authentication with setup-node style
  console.log('\n=== Authentication Test (setup-node style) ===');
  try {
    const whoamiResult = execSync('npm whoami --registry https://npm.pkg.github.com', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { 
        ...process.env, 
        NPM_CONFIG_USERCONFIG: npmrcPath,
        NODE_AUTH_TOKEN: nodeAuthToken
      }
    });
    console.log('✅ Authentication successful');
    console.log('Authenticated as:', whoamiResult.trim());
  } catch (whoamiError) {
    console.log('❌ Authentication failed');
    console.log('Error:', whoamiError.message);
    console.log('This might explain why GitHub Actions fails');
  }

  // Test 4: Test package view with setup-node style
  console.log('\n=== Package View Test (setup-node style) ===');
  try {
    const viewResult = execSync('npm view @signal-meaning/deepgram-voice-interaction-react --registry https://npm.pkg.github.com', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { 
        ...process.env, 
        NPM_CONFIG_USERCONFIG: npmrcPath,
        NODE_AUTH_TOKEN: nodeAuthToken
      }
    });
    console.log('✅ Package view successful');
    console.log('📄 Package info:');
    console.log(viewResult);
  } catch (viewError) {
    console.log('❌ Package view failed');
    console.log('Error:', viewError.message);
    console.log('This might explain why GitHub Actions fails');
  }

  // Test 5: Test publish with setup-node style
  console.log('\n=== Publish Test (setup-node style) ===');
  try {
    // Copy package files
    execSync(`cp package.json ${tempDir}/`, { stdio: 'pipe' });
    execSync(`cp -r dist ${tempDir}/`, { stdio: 'pipe' });
    
    const publishResult = execSync('npm publish --dry-run', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { 
        ...process.env, 
        NPM_CONFIG_USERCONFIG: npmrcPath,
        NODE_AUTH_TOKEN: nodeAuthToken
      }
    });
    console.log('✅ Publish dry run successful');
    console.log('📄 Publish output:');
    console.log(publishResult);
  } catch (publishError) {
    console.log('❌ Publish dry run failed');
    console.log('Error:', publishError.message);
    console.log('This explains why GitHub Actions fails');
  }

  // Test 6: Check if there are any differences in token format
  console.log('\n=== Token Analysis ===');
  console.log(`Token length: ${token.length}`);
  console.log(`Token starts with: ${token.substring(0, 10)}`);
  console.log(`Token ends with: ${token.substring(token.length - 10)}`);
  console.log(`Token contains only alphanumeric: ${/^[a-zA-Z0-9_]+$/.test(token)}`);
  
  // Check if token looks like a GitHub token
  if (token.startsWith('ghp_')) {
    console.log('✅ Token appears to be a GitHub Personal Access Token');
  } else {
    console.log('❌ Token does not start with ghp_ - might be wrong format');
  }

} finally {
  // Cleanup
  console.log('\n🧹 Cleaning up...');
  try {
    execSync(`rm -rf ${tempDir}`, { stdio: 'pipe' });
    console.log('✅ Cleaned up test directory');
  } catch (cleanupError) {
    console.log('⚠️  Could not clean up test directory:', cleanupError.message);
  }
}

console.log('\n📋 Summary:');
console.log('This script tests the exact same authentication setup that setup-node creates.');
console.log('If this fails, it explains why GitHub Actions fails.');
console.log('If this passes, there might be a different issue in GitHub Actions.');
