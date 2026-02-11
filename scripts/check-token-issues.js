#!/usr/bin/env node

/**
 * Check for common token and authentication issues
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 Checking for common token and authentication issues...\n');

// Check 1: Token format
console.log('1. Checking token format...');
if (process.env.NPM_PACKAGES_TOKEN) {
  const token = process.env.NPM_PACKAGES_TOKEN;
  console.log(`   ✅ NPM_PACKAGES_TOKEN is set`);
  console.log(`   📏 Length: ${token.length} characters`);
  console.log(`   🔑 Starts with: ${token.substring(0, 10)}...`);
  console.log(`   🔑 Ends with: ...${token.substring(token.length - 10)}`);
  
  // Check if it looks like a GitHub token
  if (token.startsWith('ghp_') || token.startsWith('gho_') || token.startsWith('ghu_') || token.startsWith('ghs_') || token.startsWith('ghr_')) {
    console.log('   ✅ Token format looks like a GitHub Personal Access Token');
  } else {
    console.log('   ⚠️  Token format doesn\'t look like a standard GitHub PAT');
  }
} else {
  console.log('   ❌ NPM_PACKAGES_TOKEN not set');
}

// Check 2: Package.json configuration
console.log('\n2. Checking package.json configuration...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`   📦 Package name: ${packageJson.name}`);
  console.log(`   📦 Version: ${packageJson.version}`);
  
  if (packageJson.name.startsWith('@signal-meaning/')) {
    console.log('   ✅ Package name has correct scope');
  } else {
    console.log('   ❌ Package name missing @signal-meaning scope');
  }
  
  if (packageJson.publishConfig) {
    console.log('   ✅ publishConfig found');
    console.log(`   📄 Registry: ${packageJson.publishConfig.registry}`);
    if (packageJson.publishConfig['@signal-meaning:registry']) {
      console.log(`   📄 Scope registry: ${packageJson.publishConfig['@signal-meaning:registry']}`);
    }
  } else {
    console.log('   ⚠️  No publishConfig found');
  }
} catch (error) {
  console.log('   ❌ Error reading package.json:', error.message);
}

// Check 3: .npmrc configuration
console.log('\n3. Checking .npmrc configuration...');
if (fs.existsSync('.npmrc')) {
  const npmrc = fs.readFileSync('.npmrc', 'utf8');
  console.log('   ✅ .npmrc file exists');
  console.log('   📄 Content:');
  console.log(npmrc);
} else {
  console.log('   ⚠️  No .npmrc file found');
}

// Check 4: Test authentication
console.log('\n4. Testing authentication...');
try {
  const whoami = execSync('npm whoami --registry https://npm.pkg.github.com', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log(`   ✅ Successfully authenticated as: ${whoami.trim()}`);
} catch (error) {
  console.log('   ❌ Authentication failed');
  console.log(`   Error: ${error.message}`);
}

// Check 5: Test package access
console.log('\n5. Testing package access...');
try {
  const view = execSync('npm view @signal-meaning/voice-agent-react --registry https://npm.pkg.github.com', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('   ✅ Package exists and is accessible');
  console.log('   📄 Package info:');
  console.log(view);
} catch (error) {
  if (error.message.includes('404')) {
    console.log('   ℹ️  Package doesn\'t exist yet (this is normal for first publish)');
  } else {
    console.log('   ❌ Package access failed');
    console.log(`   Error: ${error.message}`);
  }
}

// Check 6: Common issues checklist
console.log('\n6. Common issues checklist:');
console.log('   📋 Check these in GitHub repository settings:');
console.log('   - Repository Settings → General → Features → Packages enabled');
console.log('   - Repository Settings → Actions → General → "Read and write permissions"');
console.log('   - Organization Settings → Third-party access → OAuth App access');
console.log('   - Token has write:packages and read:packages scopes');
console.log('   - Token has access to @signal-meaning organization');

console.log('\n📋 Summary:');
console.log('Run this script locally to check your token configuration.');
console.log('If everything passes locally but fails in GitHub Actions,');
console.log('the issue is likely with the repository secret configuration.');
