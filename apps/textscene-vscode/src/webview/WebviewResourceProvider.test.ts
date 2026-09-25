/** Tests for WebviewResourceProvider: resource loading through host messages. */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { WebviewResourceProvider } from './WebviewResourceProvider';

describe('WebviewResourceProvider', () => {
  let mockVsCode: {
    postMessage: Mock<(message: unknown) => void>;
    getState: Mock<() => unknown>;
    setState: Mock<(state: unknown) => void>;
  };
  let provider: WebviewResourceProvider;
  let messageListeners: Array<(event: MessageEvent) => void>;

  beforeEach(() => {
    messageListeners = [];

    vi.spyOn(window, 'addEventListener').mockImplementation((event: string, listener: EventListenerOrEventListenerObject) => {
      if (event === 'message' && typeof listener === 'function') {
        messageListeners.push(listener as (event: MessageEvent) => void);
      }
    });

    vi.spyOn(window, 'setTimeout');
    vi.spyOn(window, 'clearTimeout');

    mockVsCode = {
      postMessage: vi.fn<(message: unknown) => void>(),
      getState: vi.fn<() => unknown>(),
      setState: vi.fn<(state: unknown) => void>()
    };

    provider = new WebviewResourceProvider(mockVsCode);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function simulateExtensionMessage(data: unknown) {
    const event = { data } as MessageEvent;
    messageListeners.forEach(listener => listener(event));
  }

  describe('Constructor', () => {
    it('should register message listener on construction', () => {
      expect(window.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
      expect(messageListeners).toHaveLength(1);
    });

    it('should initialize with empty pending requests', () => {
      // A request shows the internal state.
      provider.loadResource('res://test.txt', 'Resource');

      expect(mockVsCode.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'resource_0'
        })
      );
    });
  });

  describe('Text Resource Loading', () => {
    it('should load text resource successfully', async () => {
      const loadPromise = provider.loadResource('res://test.txt', 'Resource');

      expect(mockVsCode.postMessage).toHaveBeenCalledWith({
        type: 'loadResource',
        path: 'res://test.txt',
        resourceType: 'Resource',
        requestId: 'resource_0'
      });

      simulateExtensionMessage({
        type: 'resourceLoaded',
        requestId: 'resource_0',
        content: 'text content',
        isBinary: false
      });

      const result = await loadPromise;
      expect(result).toBe('text content');
    });

    it('should increment request counter for each request', async () => {
      const promise1 = provider.loadResource('res://file1.txt', 'Resource');
      const promise2 = provider.loadResource('res://file2.txt', 'Resource');

      expect(mockVsCode.postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
        requestId: 'resource_0'
      }));

      expect(mockVsCode.postMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
        requestId: 'resource_1'
      }));

      simulateExtensionMessage({ type: 'resourceLoaded', requestId: 'resource_0', content: 'a', isBinary: false });
      simulateExtensionMessage({ type: 'resourceLoaded', requestId: 'resource_1', content: 'b', isBinary: false });

      await Promise.all([promise1, promise2]);
    });

    it('should clear timeout on successful text load', async () => {
      const loadPromise = provider.loadResource('res://test.txt', 'Resource');

      const timeoutId = (window.setTimeout as ReturnType<typeof vi.spyOn>).mock.results[0]?.value as number;

      simulateExtensionMessage({
        type: 'resourceLoaded',
        requestId: 'resource_0',
        content: 'content',
        isBinary: false
      });

      await loadPromise;

      expect(window.clearTimeout).toHaveBeenCalledWith(timeoutId);
    });
  });

  describe('Binary Resource Loading', () => {
    it('should load binary resource with base64 decoding', async () => {
      const loadPromise = provider.loadResource('res://icon.png', 'Texture2D');

      const testBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const base64 = btoa(String.fromCharCode(...testBytes));

      simulateExtensionMessage({
        type: 'resourceLoaded',
        requestId: 'resource_0',
        content: base64,
        isBinary: true
      });

      const result = await loadPromise;

      expect(result).toBeInstanceOf(ArrayBuffer);
      const resultBytes = new Uint8Array(result as ArrayBuffer);
      expect(Array.from(resultBytes)).toEqual(Array.from(testBytes));
    });

    it('should correctly decode larger binary files', async () => {
      const loadPromise = provider.loadResource('res://large.bin', 'Resource');

      const testBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        testBytes[i] = i;
      }
      const base64 = btoa(String.fromCharCode(...testBytes));

      simulateExtensionMessage({
        type: 'resourceLoaded',
        requestId: 'resource_0',
        content: base64,
        isBinary: true
      });

      const result = await loadPromise;
      const resultBytes = new Uint8Array(result as ArrayBuffer);

      expect(resultBytes.length).toBe(256);
      expect(Array.from(resultBytes)).toEqual(Array.from(testBytes));
    });

    it('should clear timeout on successful binary load', async () => {
      const loadPromise = provider.loadResource('res://test.png', 'Texture2D');

      const timeoutId = (window.setTimeout as ReturnType<typeof vi.spyOn>).mock.results[0]?.value as number;

      simulateExtensionMessage({
        type: 'resourceLoaded',
        requestId: 'resource_0',
        content: btoa('test'),
        isBinary: true
      });

      await loadPromise;

      expect(window.clearTimeout).toHaveBeenCalledWith(timeoutId);
    });
  });

  describe('Error Handling', () => {
    it('should handle resource load error from extension', async () => {
      const loadPromise = provider.loadResource('res://missing.txt', 'Resource');

      simulateExtensionMessage({
        type: 'resourceLoadError',
        requestId: 'resource_0',
        error: 'File not found'
      });

      await expect(loadPromise).rejects.toThrow('File not found');
    });

    it('should clear timeout on error', async () => {
      const loadPromise = provider.loadResource('res://error.txt', 'Resource');

      const timeoutId = (window.setTimeout as ReturnType<typeof vi.spyOn>).mock.results[0]?.value as number;

      simulateExtensionMessage({
        type: 'resourceLoadError',
        requestId: 'resource_0',
        error: 'Load failed'
      });

      await expect(loadPromise).rejects.toThrow();
      expect(window.clearTimeout).toHaveBeenCalledWith(timeoutId);
    });

    it('should timeout after 10 seconds if no response', async () => {
      vi.useFakeTimers();

      const loadPromise = provider.loadResource('res://slow.txt', 'Resource');

      vi.advanceTimersByTime(10000);

      await expect(loadPromise).rejects.toThrow('Resource load timeout: res://slow.txt');

      vi.useRealTimers();
    });

    it('should not throw if response arrives after cleanup', async () => {
      const loadPromise = provider.loadResource('res://test.txt', 'Resource');

      simulateExtensionMessage({
        type: 'resourceLoaded',
        requestId: 'resource_0',
        content: 'content',
        isBinary: false
      });

      await loadPromise;

      // A duplicate response is ignored.
      simulateExtensionMessage({
        type: 'resourceLoaded',
        requestId: 'resource_0',
        content: 'duplicate',
        isBinary: false
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Malformed Messages', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a string', 'resourceLoaded'],
      ['a number', 42],
      ['an object with no type', {}],
    ])('should ignore %s message data and leave pending requests intact', async (_label, payload) => {
      const loadPromise = provider.loadResource('res://test.txt', 'Resource');

      expect(() => simulateExtensionMessage(payload)).not.toThrow();

      simulateExtensionMessage({
        type: 'resourceLoaded',
        requestId: 'resource_0',
        content: 'content',
        isBinary: false
      });

      await expect(loadPromise).resolves.toBe('content');
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const promise1 = provider.loadResource('res://file1.txt', 'Resource');
      const promise2 = provider.loadResource('res://file2.txt', 'Resource');
      const promise3 = provider.loadResource('res://file3.txt', 'Resource');

      // Respond out of order
      simulateExtensionMessage({ type: 'resourceLoaded', requestId: 'resource_2', content: 'content3', isBinary: false });
      simulateExtensionMessage({ type: 'resourceLoaded', requestId: 'resource_0', content: 'content1', isBinary: false });
      simulateExtensionMessage({ type: 'resourceLoaded', requestId: 'resource_1', content: 'content2', isBinary: false });

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toEqual(['content1', 'content2', 'content3']);
    });

    it('should handle mix of successful and failed requests', async () => {
      const promise1 = provider.loadResource('res://success.txt', 'Resource');
      const promise2 = provider.loadResource('res://fail.txt', 'Resource');
      const promise3 = provider.loadResource('res://success2.txt', 'Resource');

      simulateExtensionMessage({ type: 'resourceLoaded', requestId: 'resource_0', content: 'ok1', isBinary: false });
      simulateExtensionMessage({ type: 'resourceLoadError', requestId: 'resource_1', error: 'Failed' });
      simulateExtensionMessage({ type: 'resourceLoaded', requestId: 'resource_2', content: 'ok2', isBinary: false });

      const result1 = await promise1;
      await expect(promise2).rejects.toThrow('Failed');
      const result3 = await promise3;

      expect(result1).toBe('ok1');
      expect(result3).toBe('ok2');
    });
  });
});
