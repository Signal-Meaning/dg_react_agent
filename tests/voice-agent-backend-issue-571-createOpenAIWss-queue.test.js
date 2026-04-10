/** @jest-environment node */

/**
 * Issue #571: createOpenAIWss must queue client→upstream frames until upstream is OPEN.
 * Uses delayed upstream handshake (ws verifyClient async) so the relay client can send
 * while the relay→upstream socket is still CONNECTING.
 */

const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const WebSocketServer = require('ws').WebSocketServer;

const attachUpgradePath = path.resolve(__dirname, '../packages/voice-agent-backend/src/attach-upgrade.js');

describe('createOpenAIWss client message queue (Issue #571)', () => {
  jest.setTimeout(20000);

  let upstreamWss = null;
  let relayHttp = null;
  let releaseUpstreamHandshake = null;
  /** @type {import('ws')|null} */
  let activeClient = null;

  afterEach(async () => {
    if (activeClient) {
      try {
        activeClient.terminate();
      } catch (_) {
        /* ignore */
      }
      activeClient = null;
    }
    if (relayHttp) {
      relayHttp.closeAllConnections?.();
    }
    if (upstreamWss && upstreamWss._server) {
      upstreamWss._server.closeAllConnections?.();
    }
    await new Promise((resolve) => {
      if (relayHttp) relayHttp.close(() => resolve());
      else resolve();
    });
    await new Promise((resolve) => {
      if (upstreamWss) upstreamWss.close(() => resolve());
      else resolve();
    });
    relayHttp = null;
    upstreamWss = null;
    releaseUpstreamHandshake = null;
  });

  /**
   * @returns {Promise<{ relayPort: number, relayPath: string, upstreamVerifyInvoked: Promise<void> }>}
   */
  async function setupRelayWithDelayedUpstream() {
    const upstreamPath = '/upstream-ws-571';
    let verifiedCb = null;
    /** Resolves when the upstream server has received the relay upgrade (verifyClient) — still CONNECTING until cb(true). */
    let notifyUpstreamVerifyInvoked = () => {};
    const upstreamVerifyInvoked = new Promise((resolve) => {
      notifyUpstreamVerifyInvoked = resolve;
    });

    upstreamWss = new WebSocketServer({
      port: 0,
      host: '127.0.0.1',
      path: upstreamPath,
      verifyClient: (info, cb) => {
        verifiedCb = cb;
        notifyUpstreamVerifyInvoked();
      },
    });

    await new Promise((resolve, reject) => {
      upstreamWss.once('listening', resolve);
      upstreamWss.once('error', reject);
    });

    const upstreamPort = upstreamWss.address().port;
    releaseUpstreamHandshake = () => {
      if (verifiedCb) verifiedCb(true);
      verifiedCb = null;
    };

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const { createOpenAIWss } = require(attachUpgradePath);
    const proxyUrl = `ws://127.0.0.1:${upstreamPort}${upstreamPath}`;
    const relayPath = '/relay-openai-571';
    const { wss: relayWss } = createOpenAIWss({ path: relayPath, proxyUrl });

    relayHttp = http.createServer();
    relayHttp.on('upgrade', (req, socket, head) => {
      const pathname = req.url.split('?')[0];
      if (pathname === relayPath) {
        relayWss.handleUpgrade(req, socket, head, (ws) => relayWss.emit('connection', ws, req));
      } else {
        socket.destroy();
      }
    });

    await new Promise((resolve, reject) => {
      relayHttp.listen(0, '127.0.0.1', () => resolve());
      relayHttp.once('error', reject);
    });

    const relayPort = relayHttp.address().port;
    return { relayPort, relayPath, upstreamVerifyInvoked };
  }

  it(
    'forwards a client JSON frame sent before upstream WebSocket handshake completes',
    async () => {
      const { relayPort, relayPath, upstreamVerifyInvoked } = await setupRelayWithDelayedUpstream();

      const upstreamMessage = new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('upstream did not receive message within 8s')), 8000);
        upstreamWss.once('connection', (ws) => {
          ws.once('message', (data) => {
            clearTimeout(t);
            resolve(data.toString());
          });
        });
      });

      activeClient = new WebSocket(`ws://127.0.0.1:${relayPort}${relayPath}`);
      const client = activeClient;
      await new Promise((resolve, reject) => {
        client.once('open', resolve);
        client.once('error', reject);
      });

      await upstreamVerifyInvoked;

      const payload = JSON.stringify({ type: 'Settings', issue: 571 });
      client.send(payload);

      await new Promise((r) => setImmediate(r));

      releaseUpstreamHandshake();

      const received = await upstreamMessage;
      expect(received).toBe(payload);

      client.close();
      await new Promise((r) => setTimeout(r, 50));
    },
    15000
  );
});
