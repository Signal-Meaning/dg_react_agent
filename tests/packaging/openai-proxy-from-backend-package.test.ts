/**
 * Issue #445 Phase 1.1: Packaging contract — backends must be able to run the OpenAI
 * proxy from the backend package only (no resolve of voice-agent-react).
 * @see docs/issues/ISSUE-445/TDD-PLAN.md
 *
 * @jest-environment node
 */

import path from 'path';
import fs from 'fs';

const REPO_ROOT = path.resolve(__dirname, '../..');
const BACKEND_PACKAGE_DIR = path.join(REPO_ROOT, 'packages', 'voice-agent-backend');
const PROXY_ENTRY_RELATIVE = 'scripts/openai-proxy/run.ts';

describe('packaging: OpenAI proxy runnable from backend package (Issue #445)', () => {
  it('backend package directory contains OpenAI proxy entry script', () => {
    expect(fs.existsSync(BACKEND_PACKAGE_DIR)).toBe(true);
    const proxyEntryPath = path.join(BACKEND_PACKAGE_DIR, PROXY_ENTRY_RELATIVE);
    expect(fs.existsSync(proxyEntryPath)).toBe(true);
  });
});
