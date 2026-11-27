import * as THREE from 'three';
import { texture, vec2, vec4 } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit.js';
import { storedDepthOf } from '../language/storedDepthReads.js';
import {
  bindDirectionalShadowColour,
  directionalShadowAtlasNode,
  unboundDirectionalShadowColour,
  type StoredDepthRead,
} from './directionalShadowDepth.js';

/** The fragment GLSL of one raw read of the atlas at a fixed UV. */
function rawReadGlsl(read: StoredDepthRead): string {
  const stored = storedDepthOf(directionalShadowAtlasNode(read))!;
  return generatedFragmentShader(
    vec4(stored.read(vec2(0.25, 0.75) as unknown as Node) as never) as unknown as Node
  );
}

/** The colour texture node that `atlas`'s raw read samples. */
function colourOf(atlas: TextureNode): TextureNode {
  let colour: TextureNode | undefined;
  storedDepthOf(atlas)!
    .read(vec2(0.5, 0.5) as unknown as Node)
    .traverse((node) => {
      if ((node as TextureNode).isTextureNode) colour ??= node as TextureNode;
    });
  return colour!;
}

const count = (text: string, part: string) => text.split(part).length - 1;

describe('directionalShadowAtlasNode', () => {
  it('reads the two bytes in one filtered sample for sampled', () => {
    const glsl = rawReadGlsl('sampled');
    expect([glsl.includes('256.0'), count(glsl, 'texelFetch')]).toEqual([true, 0]);
  });

  it('reads the float colour in one filtered sample for float', () => {
    const glsl = rawReadGlsl('float');
    expect([glsl.includes('256.0'), count(glsl, 'texelFetch')]).toEqual([false, 0]);
  });

  it('filters four texels by hand for fetched (edge case)', () => {
    expect(count(rawReadGlsl('fetched'), 'texelFetch')).toBe(4);
  });
});

describe('bindDirectionalShadowColour', () => {
  it("binds the colour the atlas's raw read samples", () => {
    const atlas = directionalShadowAtlasNode('sampled');
    const colour = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    bindDirectionalShadowColour(atlas, colour);

    expect(colourOf(atlas).value).toBe(colour);
  });

  it('binds the unbound colour while no atlas is drawn (edge case)', () => {
    const atlas = directionalShadowAtlasNode('sampled');
    bindDirectionalShadowColour(atlas, new THREE.DataTexture(new Uint8Array(4), 1, 1));
    bindDirectionalShadowColour(atlas, undefined);

    expect(colourOf(atlas).value).toBe(unboundDirectionalShadowColour());
  });

  it('leaves a texture that is no directional atlas as it is (error case)', () => {
    const own = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const plain = texture(own) as unknown as TextureNode;
    bindDirectionalShadowColour(plain, new THREE.DataTexture(new Uint8Array(4), 1, 1));

    expect(plain.value).toBe(own);
  });
});

describe('unboundDirectionalShadowColour', () => {
  it('is one texel, which a light with no shadow never reads', () => {
    const { width, height } = unboundDirectionalShadowColour().image as { width: number; height: number };

    expect([width, height]).toEqual([1, 1]);
  });
});
