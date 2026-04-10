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

/** Safe attrs for loggers that merge a second argument into an object (strings must not be spread). */
function errorAttrs(err) {
  if (err == null) return { message: 'unknown error' };
  if (err instanceof Error) {
    const o = { message: err.message };
    if (err.code != null) o.code = err.code;
    return o;
  }
  return { message: String(err) };
}

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
 * Merge package default upstream options with caller-supplied options (Issue #441).
 * @param {boolean} useHttps - When true, base includes rejectUnauthorized: false.
 * @param {object} [callerOptions] - Caller openai.upstreamOptions (e.g. headers for Authorization).
 * @returns {object} Merged options for WebSocket client (createOpenAIWss).
 */
function mergeUpstreamOptions(useHttps, callerOptions) {
  const baseUpstreamOptions = useHttps ? { rejectUnauthorized: false } : {};
  return { ...baseUpstreamOptions, ...(callerOptions || {}) };
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
    /** Issue #489: send AgentAudioDone after first assistant ConversationText so idle timeout can start. Only send after we have forwarded at least one binary (audio) so we do not signal "done" before greeting audio arrives; if Deepgram sends ConversationText before audio, the component uses its text-only path (ConversationText → defer → idle). */
    let sentAgentAudioDoneAfterFirstAssistantText = false;
    let hasForwardedBinaryInThisConnection = false;

    const forwardQueuedDeepgramMessages = () => {
      if (clientWs.readyState === WebSocket.OPEN && deepgramMessageQueue.length > 0) {
        while (deepgramMessageQueue.length > 0) {
          const { data, isBinary } = deepgramMessageQueue.shift();
          try { clientWs.send(data, { binary: isBinary }); } catch (e) { log.error('[Proxy] send to client failed', errorAttrs(e)); }
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
          if (isBinary) {
            hasForwardedBinaryInThisConnection = true;
          }
          if (!isBinary && !sentAgentAudioDoneAfterFirstAssistantText) {
            try {
              const msg = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
              if (msg && msg.type === 'ConversationText' && msg.role === 'assistant') {
                sentAgentAudioDoneAfterFirstAssistantText = true;
                // Only send AgentAudioDone if we have already forwarded audio (so we do not signal "done" before audio arrives and cancel the idle timer when audio then starts)
                if (hasForwardedBinaryInThisConnection) {
                  clientWs.send(JSON.stringify({ type: 'AgentAudioDone' }), { binary: false });
                }
              }
            } catch (_) { /* not JSON or parse error: ignore */ }
          }
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
      log.error('[Proxy] Deepgram error', errorAttrs(err));
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1011, err instanceof Error ? err.message : String(err || 'Proxy error'));
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
    /** Issue #571: client may send Settings (or audio) before upstream is OPEN; queue like createDeepgramWss. */
    const messageQueue = [];

    clientWs.on('message', (data, isBinary) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data, { binary: isBinary });
      } else {
        messageQueue.push({ data, isBinary });
      }
    });

    clientWs.on('close', () => {
      if (upstream.readyState === WebSocket.CONNECTING || upstream.readyState === WebSocket.OPEN) {
        upstream.close();
      }
    });
    clientWs.on('error', () => {
      if (upstream.readyState === WebSocket.CONNECTING || upstream.readyState === WebSocket.OPEN) {
        upstream.close();
      }
    });

    upstream.on('open', () => {
      while (messageQueue.length > 0) {
        const { data, isBinary } = messageQueue.shift();
        upstream.send(data, { binary: isBinary });
      }
      upstream.on('message', (data, isBinary) => clientWs.send(data, { binary: isBinary }));
      upstream.on('close', () => clientWs.close());
    });
    upstream.on('error', (err) => {
      log.error('[Proxy] OpenAI upstream error', errorAttrs(err));
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
 *   openai?: { path: string, proxyUrl?: string, spawn?: { cwd: string, command: string, args: string[], env?: object, port: number }, upstreamOptions?: object } - upstreamOptions merged with package defaults; use for Authorization header for OpenAI Realtime (Issue #441)
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
    // EPIC-546: run.ts ignores generic HTTPS=1. Strip HTTPS from the subprocess so host .env cannot
    // accidentally imply proxy TLS. When this attachment serves wss (useHttps), opt in to dev TLS
    // unless the caller already set PEM paths (mkcert / operator certs).
    const merged = { ...process.env, ...env, OPENAI_PROXY_PORT: String(port) };
    delete merged.HTTPS;
    if (useHttps) {
      const k = merged.OPENAI_PROXY_TLS_KEY_PATH && String(merged.OPENAI_PROXY_TLS_KEY_PATH).trim() !== '';
      const c = merged.OPENAI_PROXY_TLS_CERT_PATH && String(merged.OPENAI_PROXY_TLS_CERT_PATH).trim() !== '';
      const hasPem = k && c;
      if (!hasPem) {
        merged.OPENAI_PROXY_INSECURE_DEV_TLS = merged.OPENAI_PROXY_INSECURE_DEV_TLS || '1';
      }
    }
    openaiChild = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: merged,
    });
    openaiChild.stdout?.on('data', (d) => process.stdout.write(d));
    openaiChild.stderr?.on('data', (d) => process.stderr.write(d));
    openaiChild.on('error', (err) => log.error('[Proxy] OpenAI subprocess error', errorAttrs(err)));
    openaiChild.on('exit', (code, sig) => {
      if (code != null && code !== 0) log.error('[Proxy] OpenAI subprocess exited', { code });
      if (sig) log.error('[Proxy] OpenAI subprocess killed', { signal: sig });
    });
    await waitForPort(port, 15000);
    openaiProxyUrl = `${wsScheme}://127.0.0.1:${port}/openai`;
  }

  if (openaiOpts?.path && openaiProxyUrl) {
    const upstreamOptions = mergeUpstreamOptions(useHttps, openaiOpts.upstreamOptions);
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
  mergeUpstreamOptions,
};
