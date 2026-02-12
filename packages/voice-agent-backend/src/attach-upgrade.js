/**
 * Issue #423: Attach WebSocket proxy upgrade handler to an HTTP(S) server.
 * Deepgram pass-through and OpenAI forwarder; optional spawn for OpenAI subprocess.
 */

const url = require('url');
const WebSocket = require('ws');
const WebSocketServer = require('ws').WebSocketServer;

const DEFAULT_AGENT_URL = 'wss://agent.deepgram.com/v1/agent/converse';
const DEFAULT_TRANSCRIPTION_URL = 'wss://api.deepgram.com/v1/listen';

function noop() {}
function getLogger(opts) {
  const log = opts?.logger;
  return {
    info: log?.info ?? noop,
    warn: log?.warn ?? noop,
    error: log?.error ?? noop,
    debug: log?.debug ?? noop,
  };
}

function getPathname(reqUrl) {
  const parsed = url.parse(reqUrl || '', false);
  return parsed.pathname || '/';
}

/**
 * Create Deepgram WebSocket proxy (client <-> Deepgram).
 * @param {{ path: string, apiKey: string, agentUrl?: string, transcriptionUrl?: string, verifyClient?: (info: object) => boolean, setSecurityHeaders?: (res: object) => void, logger?: object }} options
 * @returns {{ wss: import('ws').WebSocketServer }}
 */
function createDeepgramWss(options) {
  const { path: proxyPath, apiKey, agentUrl = DEFAULT_AGENT_URL, transcriptionUrl = DEFAULT_TRANSCRIPTION_URL, verifyClient, setSecurityHeaders } = options;
  const log = getLogger(options);

  const wss = new WebSocketServer({
    noServer: true,
    path: proxyPath,
    verifyClient: (info) => {
      if (setSecurityHeaders && info.req?.res) setSecurityHeaders(info.req.res);
      if (typeof verifyClient === 'function') return verifyClient(info);
      return true;
    },
  });

  wss.on('connection', (clientWs, req) => {
    const parsedUrl = url.parse(req.url, true);
    const serviceParam = parsedUrl.query.service;
    const serviceTypeValue = Array.isArray(serviceParam) ? serviceParam[0] : serviceParam;
    const serviceType = serviceTypeValue || (parsedUrl.pathname?.includes('transcription') ? 'transcription' : 'agent');
    const targetUrl = serviceType === 'transcription' ? transcriptionUrl : agentUrl;
    const deepgramUrl = new URL(targetUrl);
    Object.entries(parsedUrl.query).forEach(([key, value]) => {
      if (key !== 'service' && key !== 'token') {
        if (Array.isArray(value)) value.forEach((v) => deepgramUrl.searchParams.append(key, v));
        else if (value !== undefined && value !== null) deepgramUrl.searchParams.append(key, value);
      }
    });

    if (!apiKey || !apiKey.trim()) {
      log.error('[Proxy] Deepgram API key not set');
      clientWs.close(1011, 'Proxy configuration error: DEEPGRAM_API_KEY not set');
      return;
    }

    const deepgramWs = new WebSocket(deepgramUrl.toString(), ['token', apiKey.trim()]);
    const messageQueue = [];
    const deepgramMessageQueue = [];

    const forwardQueuedDeepgramMessages = () => {
      if (clientWs.readyState === WebSocket.OPEN && deepgramMessageQueue.length > 0) {
        while (deepgramMessageQueue.length > 0) {
          const { data, isBinary } = deepgramMessageQueue.shift();
          try { clientWs.send(data, { binary: isBinary }); } catch (e) { log.error('[Proxy] send to client failed', e?.message); }
        }
      }
    };

    clientWs.on('message', (data, isBinary) => {
      if (deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(data, { binary: isBinary });
      } else {
        messageQueue.push({ data, isBinary });
      }
    });

    deepgramWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(data, { binary: isBinary });
        } catch (e) {
          deepgramMessageQueue.push({ data, isBinary });
        }
      } else {
        deepgramMessageQueue.push({ data, isBinary });
        setTimeout(forwardQueuedDeepgramMessages, 100);
      }
    });

    deepgramWs.on('open', () => {
      while (messageQueue.length > 0) {
        const { data, isBinary } = messageQueue.shift();
        deepgramWs.send(data, { binary: isBinary });
      }
      forwardQueuedDeepgramMessages();
    });

    deepgramWs.on('close', (code, reason) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        const closeCode = typeof code === 'number' && code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 ? code : 1000;
        clientWs.close(closeCode, Buffer.isBuffer(reason) ? reason.toString() : (reason || 'Connection closed'));
      }
    });

    deepgramWs.on('error', (err) => {
      log.error('[Proxy] Deepgram error', err?.message);
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1011, err?.message || 'Proxy error');
    });

    clientWs.on('close', (code, reason) => {
      if (deepgramWs.readyState === WebSocket.OPEN) {
        const closeCode = typeof code === 'number' && code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 ? code : 1000;
        deepgramWs.close(closeCode, Buffer.isBuffer(reason) ? reason.toString() : (reason || 'Connection closed'));
      }
    });

    clientWs.on('error', () => { if (deepgramWs.readyState === WebSocket.OPEN) deepgramWs.close(); });
    clientWs.on('ping', () => { if (deepgramWs.readyState === WebSocket.OPEN) deepgramWs.ping(); });
  });

  return { wss };
}

/**
 * Create OpenAI WebSocket forwarder (client <-> upstream proxy).
 * @param {{ path: string, proxyUrl: string, upstreamOptions?: object, logger?: object }} options
 * @returns {{ wss: import('ws').WebSocketServer }}
 */
function createOpenAIWss(options) {
  const { path: openaiPath, proxyUrl, upstreamOptions = {} } = options;
  const log = getLogger(options);

  const wss = new WebSocketServer({ noServer: true, path: openaiPath });

  wss.on('connection', (clientWs, req) => {
    const query = req?.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const upstream = new WebSocket(proxyUrl + query, upstreamOptions);
    upstream.on('open', () => {
      clientWs.on('message', (data, isBinary) => upstream.send(data, { binary: isBinary }));
      upstream.on('message', (data, isBinary) => clientWs.send(data, { binary: isBinary }));
      clientWs.on('close', () => upstream.close());
      upstream.on('close', () => clientWs.close());
      clientWs.on('error', () => upstream.close());
      upstream.on('error', () => clientWs.close());
    });
    upstream.on('error', (err) => {
      log.error('[Proxy] OpenAI upstream error', err?.message);
      clientWs.close();
    });
  });

  return { wss };
}

function waitForPort(port, timeoutMs = 15000) {
  const net = require('net');
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const s = net.connect(port, '127.0.0.1', () => { s.destroy(); resolve(); });
      s.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`Port ${port} not ready in ${timeoutMs}ms`));
        else setTimeout(tryConnect, 200);
      });
    };
    tryConnect();
  });
}

/**
 * Attach WebSocket upgrade handler to server. Resolves when ready (after OpenAI spawn port wait if applicable).
 * @param {import('http').Server|import('https').Server} server
 * @param {{
 *   deepgram?: { path: string, apiKey: string, agentUrl?: string, transcriptionUrl?: string, verifyClient?: (info: object) => boolean, setSecurityHeaders?: (res: object) => void },
 *   openai?: { path: string, proxyUrl?: string, spawn?: { cwd: string, command: string, args: string[], env?: object, port: number }, upstreamOptions?: object },
 *   logger?: object
 * }} options
 * @returns {Promise<{ shutdown: () => Promise<void> }>}
 */
async function attachVoiceAgentUpgrade(server, options = {}) {
  if (process.env.LOG_LEVEL) {
    console.log('[voice-agent-backend] proxy LOG_LEVEL:', process.env.LOG_LEVEL);
  }
  const log = getLogger(options);
  let wssDeepgram = null;
  let wssOpenAI = null;
  let openaiChild = null;

  const deepgramOpts = options.deepgram;
  const openaiOpts = options.openai;
  const useHttps = options.https === true || options.https === '1';
  const wsScheme = useHttps ? 'wss' : 'ws';

  if (deepgramOpts?.path && deepgramOpts?.apiKey) {
    const { wss } = createDeepgramWss({ ...deepgramOpts, logger: options.logger });
    wssDeepgram = wss;
  }

  let openaiProxyUrl = openaiOpts?.proxyUrl;
  if (openaiOpts?.spawn) {
    const { spawn } = require('child_process');
    const { cwd, command, args, env = {}, port } = openaiOpts.spawn;
    openaiChild = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env, OPENAI_PROXY_PORT: String(port) },
    });
    openaiChild.stdout?.on('data', (d) => process.stdout.write(d));
    openaiChild.stderr?.on('data', (d) => process.stderr.write(d));
    openaiChild.on('error', (err) => log.error('[Proxy] OpenAI subprocess error', err?.message));
    openaiChild.on('exit', (code, sig) => {
      if (code != null && code !== 0) log.error('[Proxy] OpenAI subprocess exited', { code });
      if (sig) log.error('[Proxy] OpenAI subprocess killed', { signal: sig });
    });
    await waitForPort(port, 15000);
    openaiProxyUrl = `${wsScheme}://127.0.0.1:${port}/openai`;
  }

  if (openaiOpts?.path && openaiProxyUrl) {
    const upstreamOptions = useHttps ? { rejectUnauthorized: false } : {};
    const { wss } = createOpenAIWss({
      path: openaiOpts.path,
      proxyUrl: openaiProxyUrl,
      upstreamOptions,
      logger: options.logger,
    });
    wssOpenAI = wss;
  }

  server.on('upgrade', (req, socket, head) => {
    const pathname = getPathname(req.url);
    if (deepgramOpts && wssDeepgram && pathname === deepgramOpts.path) {
      wssDeepgram.handleUpgrade(req, socket, head, (ws) => wssDeepgram.emit('connection', ws, req));
    } else if (openaiOpts && wssOpenAI && pathname === openaiOpts.path) {
      wssOpenAI.handleUpgrade(req, socket, head, (ws) => wssOpenAI.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  async function shutdown() {
    if (openaiChild) {
      openaiChild.kill('SIGTERM');
      openaiChild = null;
    }
    const close = (wss) => new Promise((r) => (wss ? wss.close(r) : r()));
    await close(wssDeepgram);
    await close(wssOpenAI);
  }

  return { shutdown };
}

module.exports = {
  attachVoiceAgentUpgrade,
  createDeepgramWss,
  createOpenAIWss,
};
