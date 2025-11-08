#!/usr/bin/env node

/**
 * Release Documentation Validator
 * 
 * Validates that all required release documents are present before packaging.
 * This script checks for required documents based on release type and standard structure.
 */

const fs = require('fs');
const path = require('path');

// Get version from command line or package.json
const version = process.argv[2] || require('../package.json').version;
const releaseDir = path.join(__dirname, '..', 'docs', 'releases', `v${version}`);

// Standard release document structure
// Based on .github/ISSUE_TEMPLATE/release-checklist.md requirements
const STANDARD_DOCS = {
  required: {
    // Patch releases (quick-release.md): Only CHANGELOG.md required
    patch: ['CHANGELOG.md'],
    // Minor/Major releases (release-checklist.md): Full documentation required
    minor: [
      'CHANGELOG.md',           // Required - Keep a Changelog format
      'NEW-FEATURES.md',         // Required if new features added
      'API-CHANGES.md',          // Required if API changes
      'EXAMPLES.md',             // Required - Usage examples and best practices
      'PACKAGE-STRUCTURE.md'     // Required - From template
    ],
    major: [
      'CHANGELOG.md',           // Required
      'MIGRATION.md',            // Required - Breaking changes and migration guide
      'NEW-FEATURES.md',         // Required if new features added
      'API-CHANGES.md',          // Required if API changes
      'EXAMPLES.md',             // Required - Usage examples
      'PACKAGE-STRUCTURE.md'     // Required - From template
    ],
  },
  // Conditionally required based on release content
  conditional: {
    minor: {
      'MIGRATION.md': 'Required if there are breaking changes',
      'NEW-FEATURES.md': 'Required if new features are added',
      'API-CHANGES.md': 'Required if there are API changes'
    },
    major: {
      'NEW-FEATURES.md': 'Required if new features are added',
      'API-CHANGES.md': 'Required if there are API changes'
    }
  },
  // Standard documents that appear in most releases
  standard: {
    all: ['RELEASE-NOTES.md'],   // Standard release summary (present in v0.4.0, v0.4.1, v0.5.0)
  },
  // Optional documents
  optional: {
    all: ['RELEASE-STATUS.md', 'GITHUB-RELEASE-NOTES.md', 'RELEASE-CHECKLIST.md'],
  }
};

// Determine release type from version
function getReleaseType(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (patch !== 0) return 'patch';
  if (minor !== 0) return 'minor';
  return 'major';
}

// Check if file exists
function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

// Check if file has content
function hasContent(filePath) {
  if (!fileExists(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8').trim();
  return content.length > 0;
}

// Validate release documents
function validateReleaseDocs() {
  const releaseType = getReleaseType(version);
  const errors = [];
  const warnings = [];
  const info = [];

  info.push(`\n📦 Validating release documents for v${version} (${releaseType} release)`);
  info.push(`📁 Release directory: ${releaseDir}\n`);

  // Check if release directory exists
  if (!fs.existsSync(releaseDir)) {
    errors.push(`❌ Release directory does not exist: ${releaseDir}`);
    errors.push(`   Create it with: mkdir -p ${releaseDir}`);
    
    // Show what documents are required for this release type
    info.push('\n📋 Required Documents for This Release Type:');
    const requiredDocs = STANDARD_DOCS.required[releaseType] || STANDARD_DOCS.required.patch;
    requiredDocs.forEach(doc => {
      info.push(`   • ${doc}`);
    });
    
    // Show conditional requirements
    if (STANDARD_DOCS.conditional[releaseType]) {
      info.push('\n📋 Conditionally Required (if applicable):');
      Object.entries(STANDARD_DOCS.conditional[releaseType]).forEach(([doc, reason]) => {
        info.push(`   • ${doc} - ${reason}`);
      });
    }
    
    // Show standard documents
    if (STANDARD_DOCS.standard.all.length > 0) {
      info.push('\n📋 Standard Documents (recommended):');
      STANDARD_DOCS.standard.all.forEach(doc => {
        info.push(`   • ${doc}`);
      });
    }
    
    info.push('\n💡 Next Steps:');
    info.push(`   1. Create directory: mkdir -p ${releaseDir}`);
    info.push(`   2. Create required documents listed above`);
    info.push(`   3. Run validation again: npm run validate:release-docs ${version}`);
    
    printResults(errors, warnings, info);
    process.exit(1);
  }

  // Get required documents for this release type
  const requiredDocs = STANDARD_DOCS.required[releaseType] || STANDARD_DOCS.required.patch;
  
  // Check required documents
  info.push('📋 Required Documents:');
  const missingDocs = [];
  const emptyDocs = [];

  requiredDocs.forEach(doc => {
    const docPath = path.join(releaseDir, doc);
    if (!fileExists(docPath)) {
      missingDocs.push(doc);
      errors.push(`❌ Missing required document: ${doc}`);
    } else if (!hasContent(docPath)) {
      emptyDocs.push(doc);
      errors.push(`❌ Empty required document: ${doc}`);
    } else {
      info.push(`   ✅ ${doc}`);
    }
  });

  // Check conditional documents (required based on release content)
  if (STANDARD_DOCS.conditional[releaseType]) {
    info.push('\n📋 Conditionally Required Documents:');
    Object.entries(STANDARD_DOCS.conditional[releaseType]).forEach(([doc, reason]) => {
      const docPath = path.join(releaseDir, doc);
      if (!fileExists(docPath) || !hasContent(docPath)) {
        warnings.push(`⚠️  ${doc}: ${reason} (check if applicable to this release)`);
      } else {
        info.push(`   ✅ ${doc} (present)`);
      }
    });
  }

  // Check standard documents (present in most releases)
  info.push('\n📋 Standard Documents:');
  STANDARD_DOCS.standard.all.forEach(doc => {
    const docPath = path.join(releaseDir, doc);
    if (fileExists(docPath) && hasContent(docPath)) {
      info.push(`   ✅ ${doc} (standard, present)`);
    } else {
      warnings.push(`⚠️  ${doc} missing (standard document - present in v0.4.0, v0.4.1, v0.5.0)`);
    }
  });

  // Check optional documents
  info.push('\n📋 Optional Documents:');
  STANDARD_DOCS.optional.all.forEach(doc => {
    const docPath = path.join(releaseDir, doc);
    if (fileExists(docPath) && hasContent(docPath)) {
      info.push(`   ✅ ${doc} (optional, present)`);
    }
  });

  // Check PACKAGE-STRUCTURE.md template usage
  const packageStructurePath = path.join(releaseDir, 'PACKAGE-STRUCTURE.md');
  if (fileExists(packageStructurePath)) {
    const content = fs.readFileSync(packageStructurePath, 'utf8');
    if (content.includes('vX.X.X')) {
      warnings.push(`⚠️  PACKAGE-STRUCTURE.md contains template placeholders (vX.X.X) - should be updated to v${version}`);
    }
  }

  // Check CHANGELOG.md format
  const changelogPath = path.join(releaseDir, 'CHANGELOG.md');
  if (fileExists(changelogPath)) {
    const content = fs.readFileSync(changelogPath, 'utf8');
    if (!content.includes(`v${version}`)) {
      warnings.push(`⚠️  CHANGELOG.md may not be updated for v${version}`);
    }
    if (content.includes('TBD')) {
      warnings.push(`⚠️  CHANGELOG.md contains "TBD" placeholders`);
    }
  }

  // Print results
  printResults(errors, warnings, info);

  // Exit with error code if there are errors
  if (errors.length > 0) {
    process.exit(1);
  } else if (warnings.length > 0) {
    info.push('\n⚠️  Validation completed with warnings. Review warnings above.');
    process.exit(0);
  } else {
    info.push('\n✅ All required documents are present and valid!');
    process.exit(0);
  }
}

function printResults(errors, warnings, info) {
  // Print info messages
  info.forEach(msg => console.log(msg));

  // Print warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   ${warning}`));
  }

  // Print errors
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(error => console.log(`   ${error}`));
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Required documents: ${errors.length === 0 ? '✅ All present' : `❌ ${errors.length} missing or empty`}`);
  console.log(`   Warnings: ${warnings.length}`);
  console.log(`   Errors: ${errors.length}`);
}

// Run validation
validateReleaseDocs();

