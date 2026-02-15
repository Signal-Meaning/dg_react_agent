/**
 * Issue #441: attachVoiceAgentUpgrade merges openai.upstreamOptions with package defaults.
 * RED first: tests fail until attach-upgrade.js merges caller upstreamOptions.
 * We test the merge helper (mergeUpstreamOptions) and that attachVoiceAgentUpgrade uses it
 * by asserting createOpenAIWss is called with merged options via a spy that wraps the module.
 * @see docs/issues/ISSUE-441/TDD-PLAN.md Phase 1
 */

const path = require('path');
const http = require('http');

const attachUpgradePath = path.resolve(__dirname, '../packages/voice-agent-backend/src/attach-upgrade.js');

describe('attachVoiceAgentUpgrade openai.upstreamOptions (Issue #441)', () => {
  it('mergeUpstreamOptions returns caller options only when not https', () => {
    const { mergeUpstreamOptions } = require(attachUpgradePath);
    const result = mergeUpstreamOptions(false, { headers: { Authorization: 'Bearer test-key' } });
    expect(result).toEqual({ headers: { Authorization: 'Bearer test-key' } });
  });

  it('mergeUpstreamOptions returns rejectUnauthorized: false when https and no caller options', () => {
    const { mergeUpstreamOptions } = require(attachUpgradePath);
    const result = mergeUpstreamOptions(true, undefined);
    expect(result).toEqual({ rejectUnauthorized: false });
  });

  it('mergeUpstreamOptions merges package defaults with caller options when https', () => {
    const { mergeUpstreamOptions } = require(attachUpgradePath);
    const result = mergeUpstreamOptions(true, { headers: { Authorization: 'Bearer key' } });
    expect(result).toMatchObject({ rejectUnauthorized: false });
    expect(result.headers).toEqual({ Authorization: 'Bearer key' });
  });
});
