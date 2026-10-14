import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sharedTexture } from './sharedTexture';

class SharedDataTexture extends sharedTexture(THREE.DataTexture) {}

describe('sharedTexture', () => {
  it('gives a texture whose clone is itself', () => {
    const texture = new SharedDataTexture(null, 1, 1);

    expect(texture.clone()).toBe(texture);
  });

  it("keeps the base class's constructor arguments (edge case)", () => {
    const texture = new SharedDataTexture(null, 4, 2);

    expect([texture.image.width, texture.image.height]).toEqual([4, 2]);
  });

  it('survives the clone three makes of each uniform (edge case)', () => {
    const texture = new SharedDataTexture(null, 1, 1);

    const uniforms = THREE.UniformsUtils.clone({ map: { value: texture } });

    expect(uniforms.map.value).toBe(texture);
  });
});
