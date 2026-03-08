/**
 * Issue #407: Forward function-call requests to the app backend (no in-browser execution).
 * Contract: docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md
 */

import type { FunctionCallRequest, FunctionCallResponse } from '@signal-meaning/voice-agent-react';

/** Backend path for function-call (single source of truth; tests/build URL logic should match). */
export const FUNCTION_CALL_PATH = '/function-call';

/**
 * Build the full URL for POST /function-call from a base URL (no trailing slash in result path).
 * Shared logic so baseUrl + path stay consistent across callers.
 */
export function buildFunctionCallUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}${FUNCTION_CALL_PATH}`;
}

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

/** E2E diagnostic: set on window when present so tests can read step 1–2 (backend response, sendResponse). */
declare global {
  interface Window {
    __functionCallDiagnostics?: {
      url: string;
      status?: number;
      hasContent?: boolean;
      hasError?: boolean;
      contentPreview?: string;
      errorMessage?: string;
      responseSent?: { hasResult: boolean; hasError: boolean };
    };
  }
}

function setDiagnostics(update: Partial<NonNullable<Window['__functionCallDiagnostics']>>) {
  if (typeof window === 'undefined') return;
  const w = window as Window;
  w.__functionCallDiagnostics = { ...(w.__functionCallDiagnostics ?? { url: '' }), ...update };
}

/** Send error response and update diagnostics (DRY for all error exits). */
function sendErrorResponse(
  request: FunctionCallRequest,
  sendResponse: (response: FunctionCallResponse) => void,
  error: string,
  diagnostics: Partial<NonNullable<Window['__functionCallDiagnostics']>>
): void {
  setDiagnostics({ ...diagnostics, responseSent: { hasResult: false, hasError: true } });
  sendResponse({ id: request.id, error });
}

/** Send success response and update diagnostics. */
function sendSuccessResponse(
  request: FunctionCallRequest,
  sendResponse: (response: FunctionCallResponse) => void,
  result: unknown
): void {
  setDiagnostics({ responseSent: { hasResult: true, hasError: false } });
  sendResponse({ id: request.id, result });
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
    sendErrorResponse(request, sendResponse, 'Function-call backend URL not configured', { url: '' });
    return;
  }
  const url = buildFunctionCallUrl(baseUrl);
  setDiagnostics({ url });
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
    const contentPreview =
      body.content != null && typeof body.content === 'string'
        ? body.content.slice(0, 80)
        : undefined;
    setDiagnostics({
      status: res.status,
      hasContent: body.content != null,
      hasError: body.error != null,
      contentPreview,
    });
    if (body.error != null) {
      sendErrorResponse(request, sendResponse, String(body.error), { errorMessage: String(body.error) });
      return;
    }
    if (body.content != null) {
      try {
        sendSuccessResponse(request, sendResponse, JSON.parse(body.content as string));
      } catch {
        sendSuccessResponse(request, sendResponse, body.content);
      }
      return;
    }
    sendErrorResponse(request, sendResponse, res.ok ? 'Backend returned no content' : `Request failed: ${res.status}`, {});
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    sendErrorResponse(request, sendResponse, err instanceof Error ? err.message : 'Failed to call function-call backend', {
      status: undefined,
      hasContent: false,
      hasError: true,
      errorMessage,
    });
  }
}
