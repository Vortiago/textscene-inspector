import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import type { TscnInternalResource } from '../../parser/types';
import {
  clearProceduralTextureCache,
  pinProceduralTexture,
  proceduralTexture,
  proceduralTextureKey,
  unpinProceduralTexture,
} from './proceduralTextureCache';

/**
 * Mirrors `MAX_ENTRIES`. The bound is the contract — a scene pointing 65 nodes
 * at 65 distinct gradients must not keep 65 uploads resident — so the number
 * lives in the assertions rather than being probed for.
 */
const CAPACITY = 64;

/** A stand-in for a rasterised texture: only `dispose` is exercised. */
function fakeTexture(): THREE.Texture {
  return { dispose: vi.fn() } as unknown as THREE.Texture;
}

/** A distinct `internalResources` array — the cache's per-parse identity. */
function scene(): TscnInternalResource[] {
  return [];
}

// Every test starts from an empty cache. Pin counts survive `clear()` by
// design (they track mounted consumers), so a test that pins also unpins.
beforeEach(() => {
  clearProceduralTextureCache();
});

describe('proceduralTextureKey', () => {
  it('is `token:subResourceId`, stable for one parse of a scene (happy path)', () => {
    const resources = scene();
    const key = proceduralTextureKey(resources, 'Gradient_a');
    expect(key).toMatch(/^\d+:Gradient_a$/);
    expect(proceduralTextureKey(resources, 'Gradient_a')).toBe(key);
  });

  it('separates two sub-resources of the same scene', () => {
    const resources = scene();
    expect(proceduralTextureKey(resources, 'a')).not.toBe(proceduralTextureKey(resources, 'b'));
  });

  it('mints a fresh token per parse, so a reload cannot reuse an entry (edge case)', () => {
    // Re-parsing yields a new array with the same ids; the keys must differ or
    // the reloaded scene would sample the old rasterisation.
    expect(proceduralTextureKey(scene(), 'a')).not.toBe(proceduralTextureKey(scene(), 'a'));
  });
});

describe('proceduralTexture', () => {
  it('rasterises once and shares the result for the same (scene, id) (happy path)', () => {
    const resources = scene();
    const texture = fakeTexture();
    const rasterize = vi.fn(() => texture);

    const first = proceduralTexture(resources, 'a', rasterize);
    const second = proceduralTexture(resources, 'a', rasterize);

    expect(first).toBe(texture);
    expect(second).toBe(texture);
    expect(rasterize).toHaveBeenCalledTimes(1);
  });

  it('does not cache a declined rasterisation (error path)', () => {
    const resources = scene();
    const rasterize = vi.fn(() => null);

    expect(proceduralTexture(resources, 'a', rasterize)).toBeNull();
    expect(proceduralTexture(resources, 'a', rasterize)).toBeNull();
    expect(rasterize).toHaveBeenCalledTimes(2);
  });

  it('rasterises again for the same id in a re-parsed scene', () => {
    const rasterize = vi.fn(() => fakeTexture());
    proceduralTexture(scene(), 'a', rasterize);
    proceduralTexture(scene(), 'a', rasterize);
    expect(rasterize).toHaveBeenCalledTimes(2);
  });

  it('evicts and disposes the least-recently-used entry past capacity', () => {
    const resources = scene();
    const textures = Array.from({ length: CAPACITY + 1 }, fakeTexture);
    textures.forEach((texture, i) => proceduralTexture(resources, `g${i}`, () => texture));

    // The oldest entry's buffer is freed; the one just added is kept.
    expect(textures[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(textures[1]!.dispose).not.toHaveBeenCalled();
    expect(textures[CAPACITY]!.dispose).not.toHaveBeenCalled();
    // Evicted means gone, not merely stale: the next request re-rasterises.
    const replacement = fakeTexture();
    expect(proceduralTexture(resources, 'g0', () => replacement)).toBe(replacement);
  });

  it('a cache hit refreshes recency, so the next-oldest is evicted instead', () => {
    const resources = scene();
    const textures = Array.from({ length: CAPACITY }, fakeTexture);
    textures.forEach((texture, i) => proceduralTexture(resources, `g${i}`, () => texture));

    // Touch the oldest, then overflow by one.
    proceduralTexture(resources, 'g0', () => fakeTexture());
    proceduralTexture(resources, 'overflow', fakeTexture);

    expect(textures[0]!.dispose).not.toHaveBeenCalled();
    expect(textures[1]!.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('pinProceduralTexture', () => {
  it('holds a pinned entry through an overflow that would evict it', () => {
    const resources = scene();
    const pinned = fakeTexture();
    proceduralTexture(resources, 'pinned', () => pinned);
    pinProceduralTexture(proceduralTextureKey(resources, 'pinned'));

    const textures = Array.from({ length: CAPACITY }, fakeTexture);
    textures.forEach((texture, i) => proceduralTexture(resources, `g${i}`, () => texture));

    // The pin is the only reason a mounted consumer's texture survives being
    // the least-recently-used entry.
    expect(pinned.dispose).not.toHaveBeenCalled();
    expect(textures[0]!.dispose).toHaveBeenCalledTimes(1);

    unpinProceduralTexture(proceduralTextureKey(resources, 'pinned'));
  });

  it('leaves the entry evictable again after unpin (edge case)', () => {
    const resources = scene();
    const pinned = fakeTexture();
    proceduralTexture(resources, 'pinned', () => pinned);
    const key = proceduralTextureKey(resources, 'pinned');
    pinProceduralTexture(key);
    unpinProceduralTexture(key);

    Array.from({ length: CAPACITY }, fakeTexture).forEach((texture, i) =>
      proceduralTexture(resources, `g${i}`, () => texture)
    );

    expect(pinned.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('clearProceduralTextureCache', () => {
  it('disposes every unpinned entry (happy path)', () => {
    const resources = scene();
    const a = fakeTexture();
    const b = fakeTexture();
    proceduralTexture(resources, 'a', () => a);
    proceduralTexture(resources, 'b', () => b);

    clearProceduralTextureCache();

    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(b.dispose).toHaveBeenCalledTimes(1);
  });

  it('defers a pinned entry’s disposal until its consumer unpins', () => {
    const resources = scene();
    const pinned = fakeTexture();
    proceduralTexture(resources, 'pinned', () => pinned);
    const key = proceduralTextureKey(resources, 'pinned');
    pinProceduralTexture(key);

    clearProceduralTextureCache();
    // A mounted consumer is still sampling it, so clearing must not free it.
    expect(pinned.dispose).not.toHaveBeenCalled();

    unpinProceduralTexture(key);
    expect(pinned.dispose).toHaveBeenCalledTimes(1);
  });

  it('drops the entries, so the next request rasterises afresh', () => {
    const resources = scene();
    const rasterize = vi.fn(() => fakeTexture());
    proceduralTexture(resources, 'a', rasterize);
    clearProceduralTextureCache();
    proceduralTexture(resources, 'a', rasterize);
    expect(rasterize).toHaveBeenCalledTimes(2);
  });
});
