/**
 * Packaging contract — React package must not ship the OpenAI proxy (or backend/
 * maintainer-only scripts), and must not ship docs/issues (internal only).
 * @see docs/issues/ISSUE-445/TDD-PLAN.md
 * @see docs/PACKAGING-POLICY.md (issue docs not for customers)
 *
 * @jest-environment node
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '../..');
const ROOT_PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');

describe('packaging: React package must not ship OpenAI proxy (Issue #445)', () => {
  it('root package.json "files" does not include scripts (so proxy is not shipped)', () => {
    const pkg = JSON.parse(fs.readFileSync(ROOT_PACKAGE_JSON, 'utf8'));
    const files: string[] = pkg.files ?? [];
    const hasScripts = files.some(
      (entry) => entry === 'scripts' || entry.startsWith('scripts/')
    );
    expect(hasScripts).toBe(false);
  });
});

describe('packaging: React package must not ship docs/issues (PACKAGING-POLICY)', () => {
  it('npm pack --dry-run does not include docs/issues/ (internal only; not for customers)', () => {
    const out = execSync('npm pack --dry-run', {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    expect(out).not.toMatch(/docs\/issues[/\s]/);
  });
});
