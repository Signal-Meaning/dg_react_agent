const NodeEnvironment = require('jest-environment-node');
const { JSDOM } = require('jsdom');
const WebSocket = require('ws');

/**
 * Custom Jest environment that combines jsdom (for DOM) with Node.js WebSocket (for real connections)
 * 
 * This allows React components to render (via jsdom) while using real WebSocket connections
 * (via Node.js 'ws' library) instead of jsdom's WebSocket wrapper.
 */
class CustomJSDOMEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.dom = null;
  }

  async setup() {
    await super.setup();
    
    // Create jsdom instance for DOM simulation
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable',
    });

    this.dom = dom;
    const { window } = dom;

    // Copy jsdom window properties to global
    Object.defineProperty(this.global, 'window', {
      value: window,
      writable: true,
    });
    Object.defineProperty(this.global, 'document', {
      value: window.document,
      writable: true,
    });
    Object.defineProperty(this.global, 'navigator', {
      value: window.navigator,
      writable: true,
    });
    Object.defineProperty(this.global, 'HTMLElement', {
      value: window.HTMLElement,
      writable: true,
    });
    Object.defineProperty(this.global, 'Element', {
      value: window.Element,
      writable: true,
    });
    Object.defineProperty(this.global, 'Event', {
      value: window.Event,
      writable: true,
    });
    Object.defineProperty(this.global, 'EventTarget', {
      value: window.EventTarget,
      writable: true,
    });

    // CRITICAL: Override WebSocket with Node.js 'ws' library
    // This must happen AFTER jsdom creates the window, but BEFORE any code uses WebSocket
    // Delete jsdom's WebSocket first, then set ours
    delete window.WebSocket;
    this.global.WebSocket = WebSocket;
    window.WebSocket = WebSocket;
    
    // Also override on all possible global objects
    if (this.global.globalThis) {
      this.global.globalThis.WebSocket = WebSocket;
    }
    
    // Override on the window's prototype chain if needed
    Object.defineProperty(window, 'WebSocket', {
      value: WebSocket,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    
    // Ensure it's also on the global scope
    Object.defineProperty(this.global, 'WebSocket', {
      value: WebSocket,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  async teardown() {
    if (this.dom) {
      this.dom.window.close();
    }
    await super.teardown();
  }

  getVmContext() {
    return this.dom ? this.dom.getInternalVMContext() : super.getVmContext();
  }
}

module.exports = CustomJSDOMEnvironment;
