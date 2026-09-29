/**
 * Which textures three already has on the GPU. three keeps one GPU texture per source
 * and sampler settings, shared by every clone that matches, and frees it once the last
 * of them is disposed. A matching clone needs no upload of its own.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GpuResidency } from './gpuResidency';

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
