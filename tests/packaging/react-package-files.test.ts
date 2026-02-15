/**
 * Issue #445 Phase 1.2: Packaging contract — React package must not ship the OpenAI
 * proxy (or backend/maintainer-only scripts).
 * @see docs/issues/ISSUE-445/TDD-PLAN.md
 *
 * @jest-environment node
 */

import path from 'path';
import fs from 'fs';

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
