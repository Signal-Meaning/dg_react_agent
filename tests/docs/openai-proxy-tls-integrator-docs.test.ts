/**
 * Issue #552 / EPIC-546: Integrator docs must describe OpenAI proxy TLS modes, env contract,
 * migration from legacy HTTPS=1, and the packaging rule (regression guard).
 *
 * @jest-environment node
 */

import path from 'path';
import fs from 'fs';

const REPO = path.resolve(__dirname, '../..');
const BACKEND_README = path.join(REPO, 'packages', 'voice-agent-backend', 'README.md');
const RUN_OPENAI = path.join(REPO, 'docs', 'BACKEND-PROXY', 'RUN-OPENAI-PROXY.md');
const PROXY_README = path.join(REPO, 'packages', 'voice-agent-backend', 'scripts', 'openai-proxy', 'README.md');

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

describe('OpenAI proxy TLS integrator documentation (#552)', () => {
  const backend = read(BACKEND_README);

  it('voice-agent-backend README documents all TLS env vars and modes', () => {
    expect(backend).toMatch(/OPENAI_PROXY_TLS_KEY_PATH/);
    expect(backend).toMatch(/OPENAI_PROXY_TLS_CERT_PATH/);
    expect(backend).toMatch(/OPENAI_PROXY_INSECURE_DEV_TLS/);
    expect(backend).toMatch(/NODE_ENV.*production|production.*NODE_ENV/s);
    expect(backend).toMatch(/attachVoiceAgentUpgrade/);
    expect(backend).toMatch(/HTTPS/);
    expect(backend).toMatch(/mixed content|Mixed content/i);
    expect(backend).toMatch(/dependencies|peerDependencies/);
    expect(backend).toMatch(/#546|EPIC-546/);
  });

  it('RUN-OPENAI-PROXY.md documents TLS variables and clarifies HTTPS vs proxy', () => {
    const doc = read(RUN_OPENAI);
    expect(doc).toMatch(/OPENAI_PROXY_TLS_KEY_PATH/);
    expect(doc).toMatch(/OPENAI_PROXY_INSECURE_DEV_TLS/);
    expect(doc).toMatch(/HTTPS/);
  });

  it('scripts/openai-proxy/README.md points to TLS / subprocess contract', () => {
    const doc = read(PROXY_README);
    expect(doc).toMatch(/OPENAI_PROXY_INSECURE_DEV_TLS|TLS mode/i);
    expect(doc).toMatch(/voice-agent-backend\/README|packages\/voice-agent-backend\/README/);
  });
});
