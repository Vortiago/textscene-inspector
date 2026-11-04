/**
 * Which textures three already has on the GPU. three keeps one GPU texture per source
 * and sampler settings, shared by every clone that matches, and frees it once the last
 * of them is disposed. A matching clone needs no upload of its own.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GpuResidency, residencyKey } from './gpuResidency';

function sheet(): THREE.DataTexture {
  return new THREE.DataTexture(new Uint8Array(16), 2, 2);
}

describe('GpuResidency', () => {
  it('knows a held texture is resident', () => {
    const residency = new GpuResidency();
    const texture = sheet();
    residency.hold(texture);
    expect(residency.isResident(texture)).toBe(true);
  });

  it('counts a clone with the same settings as resident, since three shares its GPU texture', () => {
    const residency = new GpuResidency();
    const texture = sheet();
    residency.hold(texture);
    expect(residency.isResident(texture.clone())).toBe(true);
  });

  it('does not count a clone with other sampler settings, which three uploads separately', () => {
    const residency = new GpuResidency();
    const texture = sheet();
    residency.hold(texture);
    const repeated = texture.clone();
    repeated.wrapS = THREE.RepeatWrapping;
    expect(residency.isResident(repeated)).toBe(false);
  });

  it('does not count a texture over other pixels', () => {
    const residency = new GpuResidency();
    residency.hold(sheet());
    expect(residency.isResident(sheet())).toBe(false);
  });

  it('forgets a pair once every texture holding it is disposed', () => {
    const residency = new GpuResidency();
    const texture = sheet();
    const clone = texture.clone();
    residency.hold(texture);
    residency.hold(clone);
    texture.dispose();
    expect(residency.isResident(clone)).toBe(true);
    clone.dispose();
    expect(residency.isResident(clone)).toBe(false);
  });

  it('holds a texture once, however often it is held', () => {
    const residency = new GpuResidency();
    const texture = sheet();
    residency.hold(texture);
    residency.hold(texture);
    texture.dispose();
    expect(residency.isResident(texture)).toBe(false);
  });
});

/** Every texture field three's `getTextureCacheKey` pushes, read from three's own source. */
function threeCacheKeyFields(): string[] {
  const source = readFileSync(
    createRequire(import.meta.url).resolve('three/src/renderers/webgl/WebGLTextures.js'),
    'utf8'
  );
  const body = source.split('function getTextureCacheKey(')[1]?.split('return array.join()')[0];
  if (!body)
    throw new Error('expected `getTextureCacheKey` in WebGLTextures.js, got none: re-anchor this parse');
  return [...body.matchAll(/array\.push\(\s*texture\.([A-Za-z]+)/g)].map((match) => match[1]!);
}

/** `value` changed to another value of its own kind. */
function changed(value: unknown): unknown {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'string') return `${value}-changed`;
  return 1;
}

describe('residencyKey', () => {
  it("moves with every field of three's texture cache key", () => {
    const fields = threeCacheKeyFields();
    const unkeyed = fields.filter((field) => {
      const texture = sheet();
      const before = residencyKey(texture);
      const settings = texture as unknown as Record<string, unknown>;
      settings[field] = changed(settings[field]);
      return residencyKey(texture) === before;
    });

    expect(fields.length).toBeGreaterThanOrEqual(10);
    expect(unkeyed, `add each to residencyKey: ${unkeyed.join(', ')}`).toEqual([]);
  });
});
