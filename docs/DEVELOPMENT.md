# Development Guide: dg_react_agent

This guide explains how to develop, test, and package the `dg_react_agent` library.

## **Fork Information**

**Important:** This component was forked from the original Deepgram repository at commit `7191eb4a062f35344896e873f02eba69c9c46a2d` (pre-fork). All development after that point is considered post-fork.

- **Pre-fork (7191eb4a062f35344896e873f02eba69c9c46a2d):** Original Deepgram component with basic microphone functionality via `startAudioCapture()` method
- **Post-fork:** All enhancements, bug fixes, and new features added by Signal Meaning

The original component provided basic microphone functionality via `startAudioCapture()` method, which is preserved in this fork. Additional microphone control features like `toggleMic()` and `microphoneEnabled` prop were added post-fork and may be causing connection issues in E2E tests.

## **Quick Start**

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build

# Create local package for testing
npm run package:local

# Start development mode
npm run dev
```

## **Quick Release to Parent Project**

```bash
# Complete release workflow (if parent has automation)
cd dg_react_agent && npm run build && npm run package:local && cd .. && npm run quick-update-dg

# Manual release workflow
cd dg_react_agent
npm run build
npm run package:local
cd ../frontend
npm uninstall deepgram-voice-interaction-react
npm install ../dg_react_agent/deepgram-voice-interaction-react-0.1.1.tgz
```

## **Available Scripts**

### **Core Development**
- `npm run build` - Build the package for production
- `npm run build:watch` - Build in watch mode for development
- `npm run dev` - Alias for build:watch
- `npm run clean` - Clean build artifacts and temporary files

### **Testing**
- `npm test` - Run unit tests with Jest
- `npm run test:e2e` - Run E2E tests with Playwright
- `npm run test:e2e:ui` - Run E2E tests with UI
- `npm run test:e2e:debug` - Run E2E tests in debug mode
- `npm run test:e2e:headed` - Run E2E tests in headed mode
- `npm run test:e2e:report` - Show E2E test report

### **Code Quality**
- `npm run lint` - Run ESLint on source code
- `npm run validate` - Run package validation

### **Packaging**
- `npm run package:local` - Create local .tgz package for testing
- `npm pack` - Create package tarball (npm command)

### **Development Workflow**
- `npm run workflow` - Interactive development workflow script
- `npm run status` - Show project status and information

### **Release Management**
- `npm run release:issue` - Create release issue and working branch

## **Development Workflow**

### **1. Making Changes**

```bash
# Start development mode
npm run dev

# In another terminal, make your changes
# The package will rebuild automatically
```

### **2. Testing Changes**

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test && npm run test:e2e
```

### **3. Creating Local Package**

```bash
# Create package for local testing
npm run package:local

# This creates a .tgz file that can be installed in other projects
```

### **4. Testing in External Project**

```bash
# In your external project
npm install /path/to/dg_react_agent/deepgram-voice-interaction-react-0.1.1.tgz

# Or use the package file
npm install ./deepgram-voice-interaction-react-0.1.1.tgz
```

## **Project Structure**

```
dg_react_agent/
├── src/                    # Source code
│   ├── components/         # React components
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── index.ts           # Main entry point
├── dist/                  # Built package (generated)
├── test-app/              # Test application
├── tests/                 # Test files
│   ├── e2e/              # E2E tests
│   └── __tests__/        # Unit tests
├── scripts/               # Development scripts
│   ├── package-for-local.sh
│   └── dev-workflow.sh
├── docs/                  # Documentation
├── package.json
├── rollup.config.js       # Build configuration
├── jest.config.cjs        # Test configuration
├── playwright.config.js   # E2E test configuration
└── tsconfig.json          # TypeScript configuration
```

## **Testing Strategy**

### **Unit Tests (Jest)**
- Test individual functions and components
- Mock external dependencies
- Fast execution
- Located in `tests/__tests__/`

### **E2E Tests (Playwright)**
- Test complete user workflows
- Test real browser interactions
- Test integration with Deepgram APIs
- Located in `tests/e2e/`

### **Test App**
- Interactive test application
- Manual testing and debugging
- **Uses the built package** (not source code)
- Located in `test-app/`
- Automatically updated when package changes

## **Building and Packaging**

### **Build Process**
1. **TypeScript compilation** - Convert TS to JS
2. **Rollup bundling** - Create optimized bundles
3. **Type definitions** - Generate .d.ts files
4. **Package creation** - Create distributable package

### **Output Files**
- `dist/index.js` - CommonJS bundle
- `dist/index.esm.js` - ES Module bundle
- `dist/index.d.ts` - TypeScript definitions
- `dist/types/` - Individual type definition files

### **Package Contents**
- Built JavaScript files
- TypeScript definitions
- README.md
- package.json

## **Local Development with External Projects**

### **Method 1: NPM Pack (Recommended)**
```bash
# In dg_react_agent
npm run package:local

# In external project
npm install ./dg_react_agent/deepgram-voice-interaction-react-0.1.1.tgz
```

### **Method 2: NPM Link**
```bash
# In dg_react_agent
npm link

# In external project
npm link deepgram-voice-interaction-react
```

### **Method 3: File Path**
```bash
# In external project package.json
{
  "dependencies": {
    "deepgram-voice-interaction-react": "file:../dg_react_agent"
  }
}
```

## **Release Delivery to Parent Project (Submodule Workflow)**

When `dg_react_agent` is used as a git submodule in a parent project (like voice-commerce), follow this workflow:

### **Step 1: Prepare Release in dg_react_agent**
```bash
# In dg_react_agent directory
cd dg_react_agent

# Check status
npm run status

# Run full test suite
npm test && npm run test:e2e

# Build the package
npm run build

# Create local package for testing
npm run package:local

# Commit changes
git add .
git commit -m "feat: add new features for release"
git push origin your-branch
```

### **Step 2: Update Parent Project**
```bash
# In parent project root (e.g., voice-commerce)
cd /path/to/parent-project

# Update submodule to latest commit
git submodule update --remote dg_react_agent

# Install updated package in parent project
npm run update-dg  # If parent has update script
# OR manually:
cd frontend
npm uninstall deepgram-voice-interaction-react
npm install ../dg_react_agent/deepgram-voice-interaction-react-0.1.1.tgz
```

### **Step 3: Test Integration**
```bash
# In parent project
npm run dev:frontend
# OR
npm run dev:all

# Run parent project tests
npm run test:e2e
```

### **Step 4: Commit Submodule Changes**
```bash
# In parent project root
git add dg_react_agent
git commit -m "Update dg_react_agent submodule to latest version"
git push origin main
```

### **Automated Release Script (if parent project has it)**
```bash
# In parent project root
npm run update-dg          # Full update with verification
npm run quick-update-dg    # Quick update for rapid iteration
npm run submodule-status   # Check submodule status
```

## **Git Workflow**

### **Branching Strategy**
- `main` - Stable release branch
- `develop` - Development branch
- `feature/*` - Feature branches
- `hotfix/*` - Hotfix branches

### **Commit Convention**
```
feat: add new feature
fix: fix bug
docs: update documentation
test: add or update tests
refactor: code refactoring
chore: maintenance tasks
```

### **Pull Request Process**
1. Create feature branch from `develop`
2. Make changes and commit
3. Run tests: `npm test && npm run test:e2e`
4. Create pull request
5. Code review
6. Merge to `develop`

## **Release Process**

### **Creating Release Issues**

The project includes an automated script to streamline the release process:

```bash
# Create a patch release issue and working branch
npm run release:issue 0.4.2 patch

# Create a minor release issue and working branch  
npm run release:issue 0.5.0 minor

# Create a major release issue and working branch
npm run release:issue 1.0.0 major
```

**What this does:**
1. **Validates Environment**: Ensures working directory is clean
2. **Switches to Main**: Updates main branch with latest changes
3. **Creates GitHub Issue**: Uses appropriate template (quick-release for patches, full checklist for minor/major)
4. **Creates Working Branch**: Creates `issueNNN` branch based on main
5. **Switches to New Branch**: Leaves you ready to start release work

### **Release Issue Templates**

- **Quick Release** (Patch): Streamlined checklist for bug fixes
- **Release Checklist** (Minor/Major): Comprehensive checklist with full documentation requirements

### **Pre-release Checklist**
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Build successful: `npm run build`

### **Release Steps**
1. **Create Release Issue**: Use `npm run release:issue` or create manually
2. **Follow Checklist**: Work through the issue checklist systematically
3. **Update version**: `npm version patch|minor|major`
4. **Build package**: `npm run build`
5. **Run tests**: `npm test && npm run test:e2e`
6. **Publish**: `npm publish`
7. **Create release**: GitHub release with changelog

## **Troubleshooting**

### **Build Issues**
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### **Test Issues**
```bash
# Clear test cache
npm test -- --clearCache

# Run specific test
npm test -- --testNamePattern="specific test"
```

### **Package Issues**
```bash
# Check package contents
npm pack --dry-run

# Verify package
npm run validate
```

## **Contributing**

### **Development Setup**
1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create feature branch
5. Make changes
6. Run tests: `npm test && npm run test:e2e`
7. Submit pull request

### **Code Standards**
- Use TypeScript for all new code
- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Follow commit conventions

## **Useful Commands**

```bash
# Quick development cycle
npm run dev

# Full test suite
npm test && npm run test:e2e

# Create local package
npm run package:local

# Check project status
npm run status

# Interactive workflow
npm run workflow

# Clean everything
npm run clean
```

## API Governance Process

### Two-Layer API Validation

The component validates TWO separate APIs:

1. **Deepgram Server API**: Ensures component correctly implements Deepgram Voice Agent v1 API
2. **Component Public API**: Ensures component's own API remains stable for integrators

### Adding Component Methods/Props

When adding new methods to `DeepgramVoiceInteractionHandle`:

1. **Create GitHub Issue**: Use `.github/ISSUE_TEMPLATE/api-addition.md` template
2. **Document Addition**: Add to `tests/api-baseline/approved-additions.ts`
3. **Release Notes**: Update `docs/releases/vX.Y.Z/API-CHANGES.md`
4. **Examples**: Add usage examples if applicable
5. **JSDoc**: Add `@since vX.Y.Z` annotation

### API Validation Scripts

```bash
# Fetch latest official Deepgram API spec
npm run api:fetch-spec

# Validate against official Deepgram API
npm run api:validate

# Run all API validation tests
npm test api-validation
```

### CI Behavior

- **Local**: Warnings for unauthorized additions
- **CI**: Failures for unauthorized additions
- **Purpose**: Catch accidental API changes early

---

## **Resources**

- [Deepgram Documentation](https://developers.deepgram.com/)
- [React Documentation](https://reactjs.org/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/docs/)
