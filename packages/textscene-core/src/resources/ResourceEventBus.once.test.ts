/**
 * `ResourceEventBus.once()`, through which `ResourceLoader` awaits a peer processor:
 * it settles once, synthesises a default failure error, can wait on `failed` itself,
 * and removes its listeners after settling.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ResourceEventBus } from './ResourceEventBus';

describe('ResourceEventBus.once (live promise bridge)', () => {
  let bus: ResourceEventBus;

  beforeEach(() => {
    bus = new ResourceEventBus();
  });

  afterEach(() => {
    bus.clear();
  });

  it('resolves with the payload of the matching loaded event, ignoring other ids', async () => {
    const promise = bus.once<string>('texture', 'loaded', 'res://a.png');

    bus.emit('texture', 'loaded', 'res://other.png', 'wrong');
    bus.emit('texture', 'loaded', 'res://a.png', 'right');

    await expect(promise).resolves.toBe('right');
  });

  it('rejects with the exact emitted error instance on failed', async () => {
    const promise = bus.once<string>('texture', 'loaded', 'res://a.png');
    const boom = new Error('decode exploded');

    bus.emit<Error>('texture', 'failed', 'res://a.png', boom);

    await expect(promise).rejects.toBe(boom);
  });

  it('rejects with a synthesized default error when failed fires without an error payload', async () => {
    const promise = bus.once<string>('material', 'loaded', 'mat1');

    bus.emit('material', 'failed', 'mat1');

    await expect(promise).rejects.toThrow('Resource material:mat1 failed to load');
  });

  it('waiting specifically for the failed event resolves (does not reject) with the error payload', async () => {
    const promise = bus.once<Error>('texture', 'failed', 'res://a.png');
    const boom = new Error('expected failure');

    bus.emit<Error>('texture', 'failed', 'res://a.png', boom);

    await expect(promise).resolves.toBe(boom);
  });

  it('timeout path: rejects and removes both the loaded and failed listeners', async () => {
    const promise = bus.once<string>('texture', 'loaded', 'res://slow.png', 30);
    expect(bus.getTotalHandlerCount()).toBe(3); // loaded + companion failed + invalidated listeners

    await expect(promise).rejects.toThrow('Timeout waiting for texture:loaded:res://slow.png');
    expect(bus.getTotalHandlerCount()).toBe(0);
  });

  it('cleans up listeners after resolution — emitting again cannot re-settle or leak', async () => {
    const promise = bus.once<string>('texture', 'loaded', 'res://a.png');
    expect(bus.getTotalHandlerCount()).toBe(3);

    bus.emit('texture', 'loaded', 'res://a.png', 'first');
    await expect(promise).resolves.toBe('first');
    expect(bus.getTotalHandlerCount()).toBe(0);

    // Emitting again must be a no-op: no listeners remain and the settled
    // promise keeps its original value even after a contradictory 'failed'.
    bus.emit('texture', 'loaded', 'res://a.png', 'second');
    bus.emit<Error>('texture', 'failed', 'res://a.png', new Error('late failure'));
    expect(bus.getTotalHandlerCount()).toBe(0);
    await expect(promise).resolves.toBe('first');
  });

  it('cleans up listeners after rejection — a later loaded event does not resurrect the promise', async () => {
    const promise = bus.once<string>('texture', 'loaded', 'res://a.png');

    bus.emit<Error>('texture', 'failed', 'res://a.png', new Error('gone'));
    await expect(promise).rejects.toThrow('gone');
    expect(bus.getTotalHandlerCount()).toBe(0);

    bus.emit('texture', 'loaded', 'res://a.png', 'too late');
    await expect(promise).rejects.toThrow('gone');
  });

  it('concurrent once() calls for different ids settle and clean up independently', async () => {
    const p1 = bus.once<string>('texture', 'loaded', 'tex1');
    const p2 = bus.once<string>('texture', 'loaded', 'tex2');
    expect(bus.getTotalHandlerCount()).toBe(6);

    bus.emit('texture', 'loaded', 'tex2', 'data2');
    await expect(p2).resolves.toBe('data2');
    // Only tex1's pair remains live.
    expect(bus.getTotalHandlerCount()).toBe(3);

    bus.emit('texture', 'loaded', 'tex1', 'data1');
    await expect(p1).resolves.toBe('data1');
    expect(bus.getTotalHandlerCount()).toBe(0);
  });
});

describe('once() vs invalidated', () => {
  it('rejects when the awaited path is invalidated (a full clear drops the flight with no loaded/failed) and cleans up', async () => {
    const bus = new ResourceEventBus();
    const p = bus.once<string>('texture', 'loaded', 'res://tex.png');
    // Guard against an unhandled-rejection blip between emit and the await.
    const settled = p.catch((err: Error) => err);

    bus.emit('texture', 'invalidated', 'res://tex.png');

    const err = (await settled) as Error;
    expect(err.message).toContain('invalidated while awaited');
    expect(bus.getTotalHandlerCount()).toBe(0);
  });

  it("ignores another path's invalidation", async () => {
    const bus = new ResourceEventBus();
    const p = bus.once<string>('texture', 'loaded', 'res://tex.png');

    bus.emit('texture', 'invalidated', 'res://other.png');
    bus.emit('texture', 'loaded', 'res://tex.png', 'data');

    await expect(p).resolves.toBe('data');
    expect(bus.getTotalHandlerCount()).toBe(0);
  });
});
