/**
 * Unit tests for forwardFunctionCallToBackend (Issue #407, Phase 1.3).
 * TDD: tests define the forwarding contract; implementation in src/utils/functionCallBackend.ts.
 */

import { forwardFunctionCallToBackend, getFunctionCallBackendBaseUrl } from '../src/utils/functionCallBackend';
import type { FunctionCallRequest, FunctionCallResponse } from '../../src/types';

describe('functionCallBackend (Issue #407)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getFunctionCallBackendBaseUrl', () => {
    it('derives http base from ws proxy endpoint', () => {
      expect(getFunctionCallBackendBaseUrl('ws://localhost:8080/openai')).toBe('http://localhost:8080');
    });

    it('derives https base from wss proxy endpoint', () => {
      expect(getFunctionCallBackendBaseUrl('wss://api.example.com/openai')).toBe('https://api.example.com');
    });

    it('returns empty string for empty or invalid input', () => {
      expect(getFunctionCallBackendBaseUrl('')).toBe('');
      expect(getFunctionCallBackendBaseUrl(undefined as unknown as string)).toBe('');
    });
  });

  describe('forwardFunctionCallToBackend', () => {
    it('POSTs request to baseUrl/function-call and calls sendResponse with result', async () => {
      const request: FunctionCallRequest = {
        id: 'call_1',
        name: 'get_current_time',
        arguments: '{}',
      };
      const sendResponse = jest.fn<void, [FunctionCallResponse]>();
      (globalThis.fetch as ReturnType<typeof jest.fn>) = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: '{"time":"14:30:00","timezone":"UTC"}' }),
      });

      await forwardFunctionCallToBackend(request, sendResponse, 'http://localhost:8080');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/function-call',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Trace-Id': expect.any(String),
          }),
          body: JSON.stringify({ id: request.id, name: request.name, arguments: request.arguments }),
        })
      );
      expect(sendResponse).toHaveBeenCalledTimes(1);
      expect(sendResponse).toHaveBeenCalledWith({
        id: 'call_1',
        result: { time: '14:30:00', timezone: 'UTC' },
      });
    });

    it('calls sendResponse with error when backend returns error payload', async () => {
      const request: FunctionCallRequest = {
        id: 'call_2',
        name: 'unknown_fn',
        arguments: '{}',
      };
      const sendResponse = jest.fn<void, [FunctionCallResponse]>();
      (globalThis.fetch as ReturnType<typeof jest.fn>) = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ error: 'Unknown function: unknown_fn' }),
      });

      await forwardFunctionCallToBackend(request, sendResponse, 'http://localhost:8080');

      expect(sendResponse).toHaveBeenCalledWith({
        id: 'call_2',
        error: 'Unknown function: unknown_fn',
      });
    });

    it('sends X-Trace-Id header for correlation (Issue #412)', async () => {
      const request: FunctionCallRequest = {
        id: 'call_trace',
        name: 'get_current_time',
        arguments: '{}',
      };
      const sendResponse = jest.fn<void, [FunctionCallResponse]>();
      (globalThis.fetch as ReturnType<typeof jest.fn>) = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ content: '{}' }),
      });

      await forwardFunctionCallToBackend(request, sendResponse, 'http://localhost:8080', 'my-trace-id-123');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/function-call',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Trace-Id': 'my-trace-id-123' }),
        })
      );
    });

    it('calls sendResponse with error when fetch fails', async () => {
      const request: FunctionCallRequest = {
        id: 'call_3',
        name: 'get_current_time',
        arguments: '{}',
      };
      const sendResponse = jest.fn<void, [FunctionCallResponse]>();
      (globalThis.fetch as ReturnType<typeof jest.fn>) = jest.fn().mockRejectedValue(new Error('Network error'));

      await forwardFunctionCallToBackend(request, sendResponse, 'http://localhost:8080');

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'call_3',
          error: expect.any(String),
        })
      );
    });
  });
});
