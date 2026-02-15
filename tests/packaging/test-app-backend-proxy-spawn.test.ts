/**
 * Issue #445 Phase 1.3: Packaging contract — test-app backend must spawn the OpenAI
 * proxy with cwd (or script path) derived from the backend package, not the React package.
 * @see docs/issues/ISSUE-445/TDD-PLAN.md
 *
 * @jest-environment node
 */

import path from 'path';
import fs from 'fs';

const REPO_ROOT = path.resolve(__dirname, '../..');
const BACKEND_SERVER_PATH = path.join(REPO_ROOT, 'test-app', 'scripts', 'backend-server.js');

describe('packaging: test-app backend spawns proxy from backend package (Issue #445)', () => {
  it('backend-server.js does not use repo root for OpenAI proxy spawn cwd', () => {
    expect(fs.existsSync(BACKEND_SERVER_PATH)).toBe(true);
    const content = fs.readFileSync(BACKEND_SERVER_PATH, 'utf8');
    // Forbidden: openai spawn cwd set to repo root (path.resolve(__dirname, '..', '..')).
    // After fix: cwd must be derived from voice-agent-backend package (e.g. require.resolve).
    const repoRootCwdPattern = /cwd:\s*path\.resolve\s*\(\s*__dirname\s*,\s*['"]\.\.['"]\s*,\s*['"]\.\.['"]\s*\)/;
    expect(content).not.toMatch(repoRootCwdPattern);
  });
});
