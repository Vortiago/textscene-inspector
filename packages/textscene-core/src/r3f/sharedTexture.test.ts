import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { leaveSlot, sharedTexture, showInSlot } from './sharedTexture';

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

/** A renderer whose per-texture state is all `showInSlot` and `leaveSlot` read. */
function rendererWithHandles(): THREE.WebGLRenderer {
  const states = new WeakMap<THREE.Texture, { __webglTexture?: object }>();
  const get = (texture: THREE.Texture) => {
    const state = states.get(texture) ?? {};
    states.set(texture, state);
    return state;
  };
  return { properties: { get } } as unknown as THREE.WebGLRenderer;
}

function uploaded(renderer: THREE.WebGLRenderer): THREE.Texture {
  const texture = new THREE.Texture();
  (renderer.properties.get(texture) as { __webglTexture?: object }).__webglTexture = {};
  return texture;
}

const handleOf = (renderer: THREE.WebGLRenderer, texture: THREE.Texture) =>
  (renderer.properties.get(texture) as { __webglTexture?: object }).__webglTexture;

describe('showInSlot', () => {
  it("points the slot at the texture's GL handle", () => {
    const renderer = rendererWithHandles();
    const slot = new SharedDataTexture(null, 1, 1);
    const texture = uploaded(renderer);

    showInSlot(renderer, slot, texture);

    expect(handleOf(renderer, slot)).toBe(handleOf(renderer, texture));
  });

  it('takes the handle of the last texture shown', () => {
    const renderer = rendererWithHandles();
    const slot = new SharedDataTexture(null, 1, 1);
    const later = uploaded(renderer);
    showInSlot(renderer, slot, uploaded(renderer));

    showInSlot(renderer, slot, later);

    expect(handleOf(renderer, slot)).toBe(handleOf(renderer, later));
  });

  it('leaves the slot without a handle for a texture never uploaded (edge case)', () => {
    const renderer = rendererWithHandles();
    const slot = new SharedDataTexture(null, 1, 1);

    showInSlot(renderer, slot, new THREE.Texture());

    expect(handleOf(renderer, slot)).toBeUndefined();
  });
});

describe('leaveSlot', () => {
  it('takes the slot off the texture it shows', () => {
    const renderer = rendererWithHandles();
    const slot = new SharedDataTexture(null, 1, 1);
    const texture = uploaded(renderer);
    showInSlot(renderer, slot, texture);

    leaveSlot(renderer, slot, texture);

    expect(handleOf(renderer, slot)).toBeUndefined();
  });

  it('keeps the slot on another texture it shows', () => {
    const renderer = rendererWithHandles();
    const slot = new SharedDataTexture(null, 1, 1);
    const shown = uploaded(renderer);
    showInSlot(renderer, slot, shown);

    leaveSlot(renderer, slot, uploaded(renderer));

    expect(handleOf(renderer, slot)).toBe(handleOf(renderer, shown));
  });

  it('changes nothing on a slot that shows no texture (edge case)', () => {
    const renderer = rendererWithHandles();
    const slot = new SharedDataTexture(null, 1, 1);

    leaveSlot(renderer, slot, new THREE.Texture());

    expect(handleOf(renderer, slot)).toBeUndefined();
  });
});
