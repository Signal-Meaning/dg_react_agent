/**
 * EPIC-546: Published package must list runtime modules under `dependencies` (not devDependencies only).
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');
const PKG = path.join(REPO_ROOT, 'packages', 'voice-agent-backend', 'package.json');

describe('packaging: voice-agent-backend runtime dependencies (EPIC-546)', () => {
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it('lists selfsigned in dependencies (OpenAI proxy dev TLS path)', () => {
    expect(pkg.dependencies.selfsigned).toBeDefined();
    expect(pkg.devDependencies?.selfsigned).toBeUndefined();
  });

  it('lists OpenTelemetry log SDK in dependencies (openai-proxy logger)', () => {
    expect(pkg.dependencies['@opentelemetry/api-logs']).toBeDefined();
    expect(pkg.dependencies['@opentelemetry/sdk-logs']).toBeDefined();
    expect(pkg.devDependencies?.['@opentelemetry/api-logs']).toBeUndefined();
    expect(pkg.devDependencies?.['@opentelemetry/sdk-logs']).toBeUndefined();
  });
});
