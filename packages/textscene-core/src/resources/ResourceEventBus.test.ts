import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResourceEventBus, type EventHandler } from './ResourceEventBus';
import * as THREE from 'three';

describe('ResourceEventBus', () => {
  let eventBus: ResourceEventBus;

  beforeEach(() => {
    eventBus = new ResourceEventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('on/off', () => {
    it('subscribes to events and receives emissions', () => {
      const handler = vi.fn();
      eventBus.on('texture', 'loaded', handler);

      eventBus.emit('texture', 'loaded', 'tex1', { data: 'test' });

      expect(handler).toHaveBeenCalledWith('tex1', { data: 'test' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes from events', () => {
      const handler = vi.fn();
      eventBus.on('texture', 'loaded', handler);
      eventBus.off('texture', 'loaded', handler);

      eventBus.emit('texture', 'loaded', 'tex1', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('texture', 'loaded', handler1);
      eventBus.on('texture', 'loaded', handler2);

      eventBus.emit('texture', 'loaded', 'tex1', { data: 'test' });

      expect(handler1).toHaveBeenCalledWith('tex1', { data: 'test' });
      expect(handler2).toHaveBeenCalledWith('tex1', { data: 'test' });
    });

    it('isolates events by resource type', () => {
      const textureHandler = vi.fn();
      const materialHandler = vi.fn();

      eventBus.on('texture', 'loaded', textureHandler);
      eventBus.on('material', 'loaded', materialHandler);

      eventBus.emit('texture', 'loaded', 'tex1');

      expect(textureHandler).toHaveBeenCalled();
      expect(materialHandler).not.toHaveBeenCalled();
    });

    it('isolates events by event type', () => {
      const loadedHandler = vi.fn();
      const failedHandler = vi.fn();

      eventBus.on('texture', 'loaded', loadedHandler);
      eventBus.on('texture', 'failed', failedHandler);

      eventBus.emit('texture', 'loaded', 'tex1');

      expect(loadedHandler).toHaveBeenCalled();
      expect(failedHandler).not.toHaveBeenCalled();
    });

    it('handles errors in handlers gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      eventBus.on('texture', 'loaded', errorHandler);
      eventBus.on('texture', 'loaded', normalHandler);

      // Should not throw
      expect(() => eventBus.emit('texture', 'loaded', 'tex1')).not.toThrow();

      // Both handlers should have been called
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('emits events with correct id and data', () => {
      const handler = vi.fn();
      eventBus.on('material', 'loaded', handler);

      const testData = { color: 'red', metallic: 0.5 };
      eventBus.emit('material', 'loaded', 'mat1', testData);

      expect(handler).toHaveBeenCalledWith('mat1', testData);
    });

    it('emits events without data', () => {
      const handler = vi.fn();
      eventBus.on('scene', 'requested', handler);

      eventBus.emit('scene', 'requested', 'scene1');

      expect(handler).toHaveBeenCalledWith('scene1', undefined);
    });

    it('does not throw when no handlers registered', () => {
      expect(() => eventBus.emit('texture', 'loaded', 'tex1')).not.toThrow();
    });
  });

  describe('once', () => {
    it('resolves when matching event fires', async () => {
      const promise = eventBus.once<string>('texture', 'loaded', 'tex1');

      eventBus.emit('texture', 'loaded', 'tex1', 'textureData');

      const result = await promise;
      expect(result).toBe('textureData');
    });

    it('only resolves for matching id', async () => {
      const handler = vi.fn();
      eventBus.on('texture', 'loaded', handler);

      const promise = eventBus.once<string>('texture', 'loaded', 'tex1');

      // Emit for different id - should not resolve our promise
      eventBus.emit('texture', 'loaded', 'tex2', 'wrong');

      // Emit for correct id
      setTimeout(() => eventBus.emit('texture', 'loaded', 'tex1', 'correct'), 10);

      const result = await promise;
      expect(result).toBe('correct');
    });

    it('rejects on failed event', async () => {
      const promise = eventBus.once<string>('texture', 'loaded', 'tex1');

      const error = new Error('Load failed');
      eventBus.emit<Error>('texture', 'failed', 'tex1', error);

      await expect(promise).rejects.toThrow('Load failed');
    });

    it('cleans up handlers after resolution', async () => {
      const initialCount = eventBus.getHandlerCount('texture', 'loaded');
      const promise = eventBus.once<string>('texture', 'loaded', 'tex1');

      expect(eventBus.getHandlerCount('texture', 'loaded')).toBe(initialCount + 1);

      eventBus.emit('texture', 'loaded', 'tex1', 'data');
      await promise;

      expect(eventBus.getHandlerCount('texture', 'loaded')).toBe(initialCount);
    });

    it('cleans up handlers after rejection', async () => {
      const initialCount = eventBus.getHandlerCount('texture', 'loaded');
      const promise = eventBus.once<string>('texture', 'loaded', 'tex1');

      eventBus.emit<Error>('texture', 'failed', 'tex1', new Error('fail'));

      try {
        await promise;
      } catch {
        // Expected
      }

      expect(eventBus.getHandlerCount('texture', 'loaded')).toBe(initialCount);
    });

    it('times out if event never fires', async () => {
      const promise = eventBus.once<string>('texture', 'loaded', 'tex1', 50);

      await expect(promise).rejects.toThrow('Timeout waiting for texture:loaded:tex1');
    });

    it('does not timeout if event fires in time', async () => {
      const promise = eventBus.once<string>('texture', 'loaded', 'tex1', 1000);

      setTimeout(() => eventBus.emit('texture', 'loaded', 'tex1', 'data'), 10);

      const result = await promise;
      expect(result).toBe('data');
    });
  });

  describe('waitForAll', () => {
    it('waits for all specified resources', async () => {
      const promise = eventBus.waitForAll<string>('texture', ['tex1', 'tex2', 'tex3']);

      setTimeout(() => {
        eventBus.emit('texture', 'loaded', 'tex1', 'data1');
        eventBus.emit('texture', 'loaded', 'tex2', 'data2');
        eventBus.emit('texture', 'loaded', 'tex3', 'data3');
      }, 10);

      const results = await promise;

      expect(results.get('tex1')).toBe('data1');
      expect(results.get('tex2')).toBe('data2');
      expect(results.get('tex3')).toBe('data3');
    });

    it('handles mixed success/failure', async () => {
      const promise = eventBus.waitForAll<string>('texture', ['tex1', 'tex2']);

      setTimeout(() => {
        eventBus.emit('texture', 'loaded', 'tex1', 'data1');
        eventBus.emit<Error>('texture', 'failed', 'tex2', new Error('fail'));
      }, 10);

      const results = await promise;

      expect(results.get('tex1')).toBe('data1');
      expect(results.get('tex2')).toBeNull();
    });

    it('returns empty map for empty ids array', async () => {
      const results = await eventBus.waitForAll<string>('texture', []);
      expect(results.size).toBe(0);
    });
  });

  describe('getThreeManager', () => {
    it('returns a THREE.LoadingManager instance', () => {
      const manager = eventBus.getThreeManager();
      expect(manager).toBeInstanceOf(THREE.LoadingManager);
    });
  });

  describe('getHandlerCount', () => {
    it('returns 0 for no handlers', () => {
      expect(eventBus.getHandlerCount('texture', 'loaded')).toBe(0);
    });

    it('returns correct count after adding handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('texture', 'loaded', handler1);
      expect(eventBus.getHandlerCount('texture', 'loaded')).toBe(1);

      eventBus.on('texture', 'loaded', handler2);
      expect(eventBus.getHandlerCount('texture', 'loaded')).toBe(2);
    });

    it('returns correct count after removing handlers', () => {
      const handler = vi.fn();
      eventBus.on('texture', 'loaded', handler);
      expect(eventBus.getHandlerCount('texture', 'loaded')).toBe(1);

      eventBus.off('texture', 'loaded', handler);
      expect(eventBus.getHandlerCount('texture', 'loaded')).toBe(0);
    });
  });

  describe('getTotalHandlerCount', () => {
    it('returns 0 for no handlers', () => {
      expect(eventBus.getTotalHandlerCount()).toBe(0);
    });

    it('returns total across all event types', () => {
      eventBus.on('texture', 'loaded', vi.fn());
      eventBus.on('texture', 'failed', vi.fn());
      eventBus.on('material', 'loaded', vi.fn());

      expect(eventBus.getTotalHandlerCount()).toBe(3);
    });
  });

  describe('clear', () => {
    it('removes all handlers', () => {
      eventBus.on('texture', 'loaded', vi.fn());
      eventBus.on('material', 'loaded', vi.fn());
      eventBus.on('scene', 'failed', vi.fn());

      expect(eventBus.getTotalHandlerCount()).toBe(3);

      eventBus.clear();

      expect(eventBus.getTotalHandlerCount()).toBe(0);
    });
  });

  describe('memory safety', () => {
    it('does not accumulate handlers with repeated once calls', async () => {
      const initialCount = eventBus.getTotalHandlerCount();

      // Simulate 100 resource loads
      const promises: Promise<string>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(eventBus.once<string>('texture', 'loaded', `tex${i}`));
      }

      // Each once adds handlers
      expect(eventBus.getTotalHandlerCount()).toBeGreaterThan(initialCount);

      // Resolve all
      for (let i = 0; i < 100; i++) {
        eventBus.emit('texture', 'loaded', `tex${i}`, `data${i}`);
      }

      await Promise.all(promises);

      // All handlers should be cleaned up
      expect(eventBus.getTotalHandlerCount()).toBe(initialCount);
    });
  });

  describe('type safety', () => {
    it('allows typed event data', () => {
      interface TextureData {
        width: number;
        height: number;
        format: string;
      }

      const handler: EventHandler<TextureData> = vi.fn();
      eventBus.on<TextureData>('texture', 'loaded', handler);

      const data: TextureData = { width: 512, height: 512, format: 'RGBA' };
      eventBus.emit<TextureData>('texture', 'loaded', 'tex1', data);

      expect(handler).toHaveBeenCalledWith('tex1', data);
    });
  });
});
