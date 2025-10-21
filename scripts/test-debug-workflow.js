#!/usr/bin/env node

/**
 * Local test script that simulates the GitHub Actions debug workflow
 * This tests the exact same steps with proper error handling
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 Testing GitHub Actions debug workflow locally...\n');

// Check if NPM_PACKAGES_TOKEN is set
if (!process.env.NPM_PACKAGES_TOKEN) {
  console.log('❌ NPM_PACKAGES_TOKEN environment variable not set');
  console.log('💡 To test locally, set the token:');
  console.log('   export NPM_PACKAGES_TOKEN="your_token_here"');
  console.log('   node scripts/test-debug-workflow.js');
  process.exit(1);
}

console.log('✅ NPM_PACKAGES_TOKEN is set');

// Create a temporary directory for isolated testing
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-test-'));
console.log(`📁 Created isolated test directory: ${tempDir}`);

try {
  // Test 1: Environment Debug
  console.log('\n=== Environment Debug ===');
  const token = process.env.NPM_PACKAGES_TOKEN;
  console.log(`NODE_AUTH_TOKEN length: ${token.length}`);
  console.log(`NODE_AUTH_TOKEN starts with: ${token.substring(0, 10)}...`);
  console.log(`NODE_AUTH_TOKEN ends with: ...${token.substring(token.length - 10)}`);

  // Test 2: Create .npmrc like GitHub Actions does
  console.log('\n=== NPM Configuration ===');
  const npmrcPath = path.join(tempDir, '.npmrc');
  const npmrcContent = `//npm.pkg.github.com/:_authToken=${token}
@signal-meaning:registry=https://npm.pkg.github.com`;

  fs.writeFileSync(npmrcPath, npmrcContent);
  
  // Test npm configuration
  try {
    const npmConfig = execSync('npm config list', { 
      encoding: 'utf8',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
    console.log('📄 npm config:');
    console.log(npmConfig);
  } catch (error) {
    console.log('❌ Failed to get npm config:', error.message);
    process.exit(1);
  }

  // Test 3: Registry Ping Test
  console.log('\n=== Registry Ping Test ===');
  try {
    const pingResult = execSync('npm ping --registry https://npm.pkg.github.com', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
    console.log('✅ Registry ping successful');
    console.log(pingResult);
  } catch (pingError) {
    console.log('❌ Registry ping failed');
    console.log('Error:', pingError.message);
    process.exit(1);
  }

  // Test 4: Authentication Test
  console.log('\n=== Authentication Test ===');
  try {
    const whoamiResult = execSync('npm whoami --registry https://npm.pkg.github.com', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
    console.log('✅ Authentication successful');
    console.log('Authenticated as:', whoamiResult.trim());
  } catch (whoamiError) {
    console.log('❌ Authentication failed');
    console.log('Error:', whoamiError.message);
    process.exit(1);
  }

  // Test 5: Package Access Test
  console.log('\n=== Package Access Test ===');
  try {
    const viewResult = execSync('npm view @signal-meaning/deepgram-voice-interaction-react --registry https://npm.pkg.github.com', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrcPath }
    });
    console.log('✅ Package view successful');
    console.log('📄 Package info:');
    console.log(viewResult);
  } catch (viewError) {
    console.log('❌ Package view failed');
    console.log('Error:', viewError.message);
    process.exit(1);
  }

  // Test 6: Manual .npmrc Test
  console.log('\n=== Manual .npmrc Test ===');
  const manualNpmrcPath = path.join(tempDir, 'manual.npmrc');
  const manualNpmrcContent = `//npm.pkg.github.com/:_authToken=${token}
@signal-meaning:registry=https://npm.pkg.github.com`;

  fs.writeFileSync(manualNpmrcPath, manualNpmrcContent);
  console.log('Manual .npmrc content:');
  console.log(manualNpmrcContent);

  try {
    const manualWhoamiResult = execSync('npm whoami --registry https://npm.pkg.github.com', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: manualNpmrcPath }
    });
    console.log('✅ Manual authentication successful');
    console.log('Authenticated as:', manualWhoamiResult.trim());
  } catch (manualWhoamiError) {
    console.log('❌ Manual authentication failed');
    console.log('Error:', manualWhoamiError.message);
    process.exit(1);
  }

  // Test 7: Testing actual publish (dry run)
  console.log('\n=== Testing actual publish (dry run) ===');
  try {
    // Copy package files to temp directory
    console.log('   Copying package files to isolated environment...');
    execSync(`cp package.json ${tempDir}/`, { stdio: 'pipe' });
    execSync(`cp package-lock.json ${tempDir}/ 2>/dev/null || true`, { stdio: 'pipe' });
    
    // Build if dist doesn't exist
    if (!fs.existsSync('dist')) {
      console.log('   Building package...');
      execSync('npm run build', { stdio: 'pipe' });
    }
    execSync(`cp -r dist ${tempDir}/`, { stdio: 'pipe' });

    // Test publish with dry run
    console.log('   Testing publish with dry run...');
    const publishResult = execSync('npm publish --dry-run', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: tempDir,
      env: { ...process.env, NPM_CONFIG_USERCONFIG: manualNpmrcPath }
    });
    console.log('✅ Dry run publish successful');
    console.log('📄 Dry run output:');
    console.log(publishResult);
  } catch (publishError) {
    console.log('❌ Dry run publish failed');
    console.log('Error:', publishError.message);
    process.exit(1);
  }

  console.log('\n🎉 All tests passed! The NPM_PACKAGES_TOKEN works correctly.');
  console.log('The GitHub Actions debug workflow should now pass.');

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
console.log('This script tests the exact same steps as the GitHub Actions debug workflow.');
console.log('If all tests pass, the debug workflow should also pass.');
console.log('If any test fails, the debug workflow will also fail with the same error.');
