import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { texelTexture, textureMipChain } from './texelTexture';
import { mipChain } from '../processing/mipChain';

function base(): { data: Uint8Array; width: number; height: number } {
  return { data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]), width: 2, height: 1 };
}

describe('texelTexture', () => {
  it('uploads a chain as its levels and asks the GPU for none', () => {
    const levels = mipChain(base(), false);

    const texture = texelTexture(new THREE.Texture(), levels);

    expect([texture.mipmaps, texture.generateMipmaps]).toEqual([levels, false]);
  });

  it('samples, tags and flips as its source', () => {
    const source = new THREE.Texture();
    source.wrapS = THREE.RepeatWrapping;
    source.colorSpace = THREE.SRGBColorSpace;
    source.flipY = false;

    const texture = texelTexture(source, [base()]);

    expect([texture.wrapS, texture.colorSpace, texture.flipY]).toEqual([
      THREE.RepeatWrapping,
      THREE.SRGBColorSpace,
      false,
    ]);
  });

  it('asks the GPU for the chain of a single level whose source samples one (edge case)', () => {
    const texture = texelTexture(new THREE.Texture(), [base()]);

    expect([texture.mipmaps, texture.generateMipmaps]).toEqual([[], true]);
  });

  it('refuses an empty chain', () => {
    expect(() => texelTexture(new THREE.Texture(), [])).toThrow('expected at least one level, got none');
  });
});

describe('textureMipChain', () => {
  /** A 1 × 3 column, its rows red, green and blue from the top. */
  const column = (): Uint8Array => new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);

  it('averages the top two rows of a top-down image and drops the bottom one', () => {
    const texture = new THREE.Texture();
    const levels = textureMipChain(texture, { data: column(), width: 1, height: 3 }, false);

    expect(Array.from(levels[1]!.data)).toEqual([128, 128, 0, 255]);
  });

  it("drops the top row of a bottom-up DataTexture, Godot's bottom row (edge case)", () => {
    const bottomUp = new Uint8Array([0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255]);
    const texture = new THREE.DataTexture(bottomUp, 1, 3);
    const levels = textureMipChain(texture, { data: bottomUp, width: 1, height: 3 }, false);

    expect(Array.from(levels[1]!.data)).toEqual([128, 128, 0, 255]);
  });

  it('keeps the base level as given', () => {
    const base = { data: column(), width: 1, height: 3 };

    expect(textureMipChain(new THREE.Texture(), base, false)[0]).toBe(base);
  });
});
