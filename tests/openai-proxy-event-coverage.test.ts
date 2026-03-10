/**
 * Regression test: every OpenAI Realtime server event type in the canonical list
 * must have a branch in server.ts (map or explicit ignore). Unmapped = unknown future only.
 * See docs/issues/ISSUE-512-515/UPSTREAM-EVENT-COVERAGE-PLAN.md
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const CANONICAL_LIST_PATH = path.join(
  REPO_ROOT,
  'packages/voice-agent-backend/scripts/openai-proxy/OPENAI-REALTIME-SERVER-EVENT-TYPES.ts'
);
const SERVER_TS_PATH = path.join(REPO_ROOT, 'packages/voice-agent-backend/scripts/openai-proxy/server.ts');

function extractCanonicalEventTypes(content: string): string[] {
  const match = content.match(/OPENAI_REALTIME_SERVER_EVENT_TYPES[^[]*\[([\s\S]*?)\]\s*as const/);
  if (!match) return [];
  const inner = match[1];
  const types: string[] = [];
  const lineMatches = inner.matchAll(/\s*'([^']+)'/g);
  for (const m of lineMatches) {
    types.push(m[1]);
  }
  return types;
}

function extractHandledEventTypes(serverTsContent: string): Set<string> {
  const handled = new Set<string>();
  const regex = /msg\.type\s*===\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(serverTsContent)) !== null) {
    handled.add(m[1]);
  }
  return handled;
}

describe('OpenAI proxy upstream event coverage', () => {
  it('every canonical server event type has a branch in server.ts (unmapped = unknown future only)', () => {
    const canonicalPath = CANONICAL_LIST_PATH;
    const serverPath = SERVER_TS_PATH;
    expect(fs.existsSync(canonicalPath)).toBe(true);
    expect(fs.existsSync(serverPath)).toBe(true);

    const canonicalContent = fs.readFileSync(canonicalPath, 'utf-8');
    const serverContent = fs.readFileSync(serverPath, 'utf-8');

    const canonicalTypes = extractCanonicalEventTypes(canonicalContent);
    const handledTypes = extractHandledEventTypes(serverContent);

    const missing = canonicalTypes.filter((t) => !handledTypes.has(t));
    expect(missing).toEqual([]);
  });
});
