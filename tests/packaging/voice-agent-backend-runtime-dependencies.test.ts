/**
 * EPIC-546 / #547 / #548: Published @signal-meaning/voice-agent-backend must declare
 * every npm module loaded at runtime by shipped openai-proxy code under `dependencies`.
 * Consumers do not install package devDependencies (Voice Commerce defect: MODULE_NOT_FOUND: selfsigned).
 *
 * @jest-environment node
 */

import path from 'path';
import fs from 'fs';

const REPO_ROOT = path.resolve(__dirname, '../..');
const PKG_JSON = path.join(REPO_ROOT, 'packages', 'voice-agent-backend', 'package.json');

describe('voice-agent-backend packaging: runtime dependencies (EPIC-546)', () => {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

  beforeAll(() => {
    pkg = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8'));
  });

  it('declares selfsigned in dependencies (HTTPS / insecure-dev TLS path loads it)', () => {
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies).toHaveProperty('selfsigned');
  });

  it('declares @opentelemetry/api-logs in dependencies (logger.ts imports it on every proxy load)', () => {
    expect(pkg.dependencies).toHaveProperty('@opentelemetry/api-logs');
  });

  it('declares @opentelemetry/sdk-logs in dependencies (logger.ts imports it on every proxy load)', () => {
    expect(pkg.dependencies).toHaveProperty('@opentelemetry/sdk-logs');
  });

  it('declares @opentelemetry/resources in dependencies (logger.ts Resource for service.name)', () => {
    expect(pkg.dependencies).toHaveProperty('@opentelemetry/resources');
  });

  it('declares @opentelemetry/api in dependencies (logger.ts trace context for LogRecord)', () => {
    expect(pkg.dependencies).toHaveProperty('@opentelemetry/api');
  });

  it('declares @opentelemetry/core in dependencies (logger.ts compact console exporter)', () => {
    expect(pkg.dependencies).toHaveProperty('@opentelemetry/core');
  });
});
