/**
 * Issue #407: Forward function-call requests to the app backend (no in-browser execution).
 * Contract: docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md
 */

import type { FunctionCallRequest, FunctionCallResponse } from '../../../src/types';

/**
 * Derive HTTP(S) base URL from the WebSocket proxy endpoint for POST /function-call.
 * e.g. ws://localhost:8080/openai -> http://localhost:8080
 */
export function getFunctionCallBackendBaseUrl(proxyEndpoint: string | undefined): string {
  if (!proxyEndpoint || !proxyEndpoint.trim()) return '';
  const trimmed = proxyEndpoint.trim();
  const httpScheme = trimmed.startsWith('wss://') ? 'https://' : 'http://';
  const withoutScheme = trimmed.replace(/^wss?:\/\//, '');
  const hostPort = withoutScheme.split('/')[0] ?? '';
  return hostPort ? `${httpScheme}${hostPort}` : '';
}

/** Generate a trace/request ID for correlation (Issue #412). */
function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as { randomUUID?: () => string }).randomUUID === 'function') {
    return (crypto as { randomUUID: () => string }).randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Forward a function-call request to the app backend and call sendResponse with the result or error.
 * Sends X-Trace-Id so backend logs can be correlated (Issue #412).
 */
export async function forwardFunctionCallToBackend(
  request: FunctionCallRequest,
  sendResponse: (response: FunctionCallResponse) => void,
  baseUrl: string,
  traceId?: string
): Promise<void> {
  if (!baseUrl) {
    sendResponse({ id: request.id, error: 'Function-call backend URL not configured' });
    return;
  }
  const url = `${baseUrl.replace(/\/$/, '')}/function-call`;
  const requestTraceId = traceId ?? generateTraceId();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trace-Id': requestTraceId,
      },
      body: JSON.stringify({
        id: request.id,
        name: request.name,
        arguments: request.arguments ?? '{}',
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.error != null) {
      sendResponse({ id: request.id, error: String(body.error) });
      return;
    }
    if (body.content != null) {
      try {
        const result = JSON.parse(body.content as string);
        sendResponse({ id: request.id, result });
      } catch {
        sendResponse({ id: request.id, result: body.content });
      }
      return;
    }
    sendResponse({
      id: request.id,
      error: res.ok ? 'Backend returned no content' : `Request failed: ${res.status}`,
    });
  } catch (err) {
    sendResponse({
      id: request.id,
      error: err instanceof Error ? err.message : 'Failed to call function-call backend',
    });
  }
}
