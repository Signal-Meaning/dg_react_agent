/**
 * Unit tests for Mock Backend Proxy Server
 * 
 * Tests that the proxy server correctly:
 * 1. Detects service type from query parameters
 * 2. Routes agent connections to agent endpoint
 * 3. Routes transcription connections to transcription endpoint
 * 4. Forwards query parameters correctly (excluding service and token)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import url from 'url';

// Mock the proxy server logic for testing
function detectServiceType(reqUrl) {
  const parsedUrl = url.parse(reqUrl, true);
  const serviceParam = parsedUrl.query.service;
  const serviceTypeValue = Array.isArray(serviceParam) ? serviceParam[0] : serviceParam;
  return serviceTypeValue || (parsedUrl.pathname?.includes('transcription') ? 'transcription' : 'agent');
}

function getTargetEndpoint(serviceType) {
  const DEEPGRAM_AGENT_URL = 'wss://agent.deepgram.com/v1/agent/converse';
  const DEEPGRAM_TRANSCRIPTION_URL = 'wss://api.deepgram.com/v1/listen';
  return serviceType === 'transcription' ? DEEPGRAM_TRANSCRIPTION_URL : DEEPGRAM_AGENT_URL;
}

function forwardQueryParams(reqUrl, targetUrl) {
  const parsedUrl = url.parse(reqUrl, true);
  const targetUrlObj = new URL(targetUrl);
  
  // Forward all query parameters except 'service' (routing only) and 'token' (auth handled by proxy)
  Object.entries(parsedUrl.query).forEach(([key, value]) => {
    if (key !== 'service' && key !== 'token') {
      if (Array.isArray(value)) {
        value.forEach(v => targetUrlObj.searchParams.append(key, v));
      } else if (value !== undefined && value !== null) {
        targetUrlObj.searchParams.append(key, value);
      }
    }
  });
  
  return targetUrlObj.toString();
}

describe('Mock Proxy Server - Service Type Detection', () => {
  it('should detect agent service from query parameter', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy?service=agent';
    const serviceType = detectServiceType(reqUrl);
    expect(serviceType).toBe('agent');
  });

  it('should detect transcription service from query parameter', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy?service=transcription';
    const serviceType = detectServiceType(reqUrl);
    expect(serviceType).toBe('transcription');
  });

  it('should default to agent when service parameter is missing', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy';
    const serviceType = detectServiceType(reqUrl);
    expect(serviceType).toBe('agent');
  });

  it('should handle array service parameter (first value)', () => {
    // Simulate URL.parse returning array for duplicate params
    const parsedUrl = url.parse('ws://localhost:8080/deepgram-proxy?service=transcription&service=agent', true);
    const serviceParam = parsedUrl.query.service;
    const serviceTypeValue = Array.isArray(serviceParam) ? serviceParam[0] : serviceParam;
    expect(serviceTypeValue).toBe('transcription');
  });

  it('should detect transcription from pathname when query param missing', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy/transcription';
    const serviceType = detectServiceType(reqUrl);
    expect(serviceType).toBe('transcription');
  });
});

describe('Mock Proxy Server - Endpoint Routing', () => {
  it('should route agent service to agent endpoint', () => {
    const serviceType = 'agent';
    const targetUrl = getTargetEndpoint(serviceType);
    expect(targetUrl).toBe('wss://agent.deepgram.com/v1/agent/converse');
  });

  it('should route transcription service to transcription endpoint', () => {
    const serviceType = 'transcription';
    const targetUrl = getTargetEndpoint(serviceType);
    expect(targetUrl).toBe('wss://api.deepgram.com/v1/listen');
  });
});

describe('Mock Proxy Server - Query Parameter Forwarding', () => {
  it('should forward transcription query parameters to Deepgram', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy?service=transcription&model=nova-3&language=en-US&smart_format=true';
    const serviceType = detectServiceType(reqUrl);
    const targetUrl = getTargetEndpoint(serviceType);
    const finalUrl = forwardQueryParams(reqUrl, targetUrl);
    
    const finalUrlObj = new URL(finalUrl);
    expect(finalUrlObj.searchParams.get('model')).toBe('nova-3');
    expect(finalUrlObj.searchParams.get('language')).toBe('en-US');
    expect(finalUrlObj.searchParams.get('smart_format')).toBe('true');
    expect(finalUrlObj.searchParams.get('service')).toBeNull(); // Should be excluded
  });

  it('should exclude service parameter from forwarded params', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy?service=transcription&model=nova-3';
    const serviceType = detectServiceType(reqUrl);
    const targetUrl = getTargetEndpoint(serviceType);
    const finalUrl = forwardQueryParams(reqUrl, targetUrl);
    
    const finalUrlObj = new URL(finalUrl);
    expect(finalUrlObj.searchParams.get('service')).toBeNull();
    expect(finalUrlObj.searchParams.get('model')).toBe('nova-3');
  });

  it('should exclude token parameter from forwarded params', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy?service=agent&token=test-token';
    const serviceType = detectServiceType(reqUrl);
    const targetUrl = getTargetEndpoint(serviceType);
    const finalUrl = forwardQueryParams(reqUrl, targetUrl);
    
    const finalUrlObj = new URL(finalUrl);
    expect(finalUrlObj.searchParams.get('token')).toBeNull();
  });

  it('should forward all transcription parameters including arrays', () => {
    // Simulate keyterm parameters (array values)
    const reqUrl = 'ws://localhost:8080/deepgram-proxy?service=transcription&model=nova-3&keyterm=hello&keyterm=world';
    const serviceType = detectServiceType(reqUrl);
    const targetUrl = getTargetEndpoint(serviceType);
    const finalUrl = forwardQueryParams(reqUrl, targetUrl);
    
    const finalUrlObj = new URL(finalUrl);
    expect(finalUrlObj.searchParams.get('model')).toBe('nova-3');
    expect(finalUrlObj.searchParams.getAll('keyterm')).toEqual(['hello', 'world']);
    expect(finalUrlObj.searchParams.get('service')).toBeNull();
  });

  it('should forward agent query parameters (if any)', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy?service=agent';
    const serviceType = detectServiceType(reqUrl);
    const targetUrl = getTargetEndpoint(serviceType);
    const finalUrl = forwardQueryParams(reqUrl, targetUrl);
    
    // Agent typically doesn't have query params, but should handle if present
    const finalUrlObj = new URL(finalUrl);
    expect(finalUrlObj.searchParams.get('service')).toBeNull();
    expect(finalUrlObj.hostname).toBe('agent.deepgram.com');
  });
});

describe('Mock Proxy Server - Integration', () => {
  it('should correctly process transcription connection request', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy?service=transcription&model=nova-3&language=en-US&smart_format=true&interim_results=true&diarize=true&channels=1&vad_events=true&utterance_end_ms=1000&sample_rate=16000&encoding=linear16';
    
    const serviceType = detectServiceType(reqUrl);
    expect(serviceType).toBe('transcription');
    
    const targetUrl = getTargetEndpoint(serviceType);
    expect(targetUrl).toBe('wss://api.deepgram.com/v1/listen');
    
    const finalUrl = forwardQueryParams(reqUrl, targetUrl);
    const finalUrlObj = new URL(finalUrl);
    
    // Verify all transcription params are forwarded
    expect(finalUrlObj.searchParams.get('model')).toBe('nova-3');
    expect(finalUrlObj.searchParams.get('language')).toBe('en-US');
    expect(finalUrlObj.searchParams.get('smart_format')).toBe('true');
    expect(finalUrlObj.searchParams.get('interim_results')).toBe('true');
    expect(finalUrlObj.searchParams.get('diarize')).toBe('true');
    expect(finalUrlObj.searchParams.get('channels')).toBe('1');
    expect(finalUrlObj.searchParams.get('vad_events')).toBe('true');
    expect(finalUrlObj.searchParams.get('utterance_end_ms')).toBe('1000');
    expect(finalUrlObj.searchParams.get('sample_rate')).toBe('16000');
    expect(finalUrlObj.searchParams.get('encoding')).toBe('linear16');
    
    // Verify service is excluded
    expect(finalUrlObj.searchParams.get('service')).toBeNull();
  });

  it('should correctly process agent connection request', () => {
    const reqUrl = 'ws://localhost:8080/deepgram-proxy?service=agent';
    
    const serviceType = detectServiceType(reqUrl);
    expect(serviceType).toBe('agent');
    
    const targetUrl = getTargetEndpoint(serviceType);
    expect(targetUrl).toBe('wss://agent.deepgram.com/v1/agent/converse');
    
    const finalUrl = forwardQueryParams(reqUrl, targetUrl);
    const finalUrlObj = new URL(finalUrl);
    
    // Verify service is excluded
    expect(finalUrlObj.searchParams.get('service')).toBeNull();
    expect(finalUrlObj.hostname).toBe('agent.deepgram.com');
    expect(finalUrlObj.pathname).toBe('/v1/agent/converse');
  });
});

