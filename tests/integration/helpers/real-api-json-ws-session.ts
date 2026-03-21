/**
 * DRY helper for OpenAI proxy integration tests that speak JSON over WebSocket (USE_REAL_APIS=1).
 * Handles common patterns: deadline, finish once, ignore non-JSON frames, SyntaxError on ambiguous binary.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WebSocket = require('ws') as typeof import('ws');

export type JsonHandlerResult = void | { done: true } | { fail: Error };

export interface RunRealApiJsonWsSessionOptions {
  url: string;
  deadlineMs: number;
  onOpen: (sendJson: (obj: unknown) => void) => void;
  /** Called for frames that start with `{` (0x7b) after JSON.parse succeeds. */
  onJsonMessage: (msg: Record<string, unknown>, sendJson: (obj: unknown) => void) => JsonHandlerResult;
  /** Optional: non-JSON frames (e.g. PCM). */
  onBinaryFrame?: (data: Buffer) => void;
}

/**
 * Run one WebSocket session; resolves on first `{ done: true }`, rejects on `{ fail }`, timeout, or ws error.
 */
export function runRealApiJsonWsSession(options: RunRealApiJsonWsSessionOptions): Promise<void> {
  const { url, deadlineMs, onOpen, onJsonMessage, onBinaryFrame } = options;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url) as InstanceType<typeof WebSocket>;
    let finished = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (err?: Error) => {
      if (finished) return;
      finished = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve();
    };

    const sendJson = (obj: unknown) => {
      ws.send(JSON.stringify(obj));
    };

    timeoutId = setTimeout(() => {
      if (!finished) finish(new Error(`runRealApiJsonWsSession: deadline exceeded (${deadlineMs}ms)`));
    }, deadlineMs);

    ws.on('open', () => {
      onOpen(sendJson);
    });

    ws.on('message', (data: Buffer) => {
      if (finished) return;
      if (data.length === 0 || data[0] !== 0x7b) {
        onBinaryFrame?.(data);
        return;
      }
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        const r = onJsonMessage(msg, sendJson);
        if (r && 'fail' in r) finish(r.fail);
        else if (r && 'done' in r && r.done) finish();
      } catch (e) {
        if (e instanceof SyntaxError) return;
        finish(e as Error);
      }
    });

    ws.on('error', (err: Error) => finish(err));
  });
}
