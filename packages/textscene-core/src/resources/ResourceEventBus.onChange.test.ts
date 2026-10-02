/**
 * `onChange` is one subscription for a reader of the caches: every `loaded`, `failed`
 * and `invalidated` on the buses it lists, and nothing else.
 */
import { describe, expect, it, vi } from 'vitest';
import { ResourceEventBus } from './ResourceEventBus';

describe('ResourceEventBus.onChange', () => {
  it('reports loaded, failed and invalidated with the bus and the key', () => {
    const bus = new ResourceEventBus();
    const listener = vi.fn();
    bus.onChange(['theme', 'font'], listener);

    bus.emit('theme', 'loaded', 'res://ui.tres');
    bus.emit('font', 'failed', 'res://a.ttf');
    bus.emit('font', 'invalidated', 'res://b.ttf');

    expect(listener.mock.calls).toEqual([
      [{ busType: 'theme', event: 'loaded', key: 'res://ui.tres' }],
      [{ busType: 'font', event: 'failed', key: 'res://a.ttf' }],
      [{ busType: 'font', event: 'invalidated', key: 'res://b.ttf' }],
    ]);
  });

  it('ignores a bus it does not list', () => {
    const bus = new ResourceEventBus();
    const listener = vi.fn();
    bus.onChange(['theme'], listener);

    bus.emit('glb', 'loaded', 'res://prop.glb');

    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores the progress events of a load', () => {
    const bus = new ResourceEventBus();
    const listener = vi.fn();
    bus.onChange(['texture'], listener);

    bus.emit('texture', 'requested', 'res://a.png');
    bus.emit('texture', 'loading', 'res://a.png');

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops after its unsubscribe and leaves no handler behind', () => {
    const bus = new ResourceEventBus();
    const listener = vi.fn();
    const unsubscribe = bus.onChange(['theme', 'font'], listener);

    unsubscribe();
    bus.emit('theme', 'loaded', 'res://ui.tres');

    expect(listener).not.toHaveBeenCalled();
    expect(bus.getTotalHandlerCount()).toBe(0);
  });

  it('counts as handlers, and goes with clear()', () => {
    const bus = new ResourceEventBus();
    const listener = vi.fn();
    bus.onChange(['theme'], listener);
    expect(bus.getTotalHandlerCount()).toBe(3);

    bus.clear();
    bus.emit('theme', 'loaded', 'res://ui.tres');

    expect(listener).not.toHaveBeenCalled();
  });

  it('lets the other listeners run when one throws', () => {
    const bus = new ResourceEventBus();
    const second = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    bus.onChange(['theme'], () => {
      throw new Error('boom');
    });
    bus.onChange(['theme'], second);

    bus.emit('theme', 'loaded', 'res://ui.tres');

    expect(second).toHaveBeenCalled();
  });
});
