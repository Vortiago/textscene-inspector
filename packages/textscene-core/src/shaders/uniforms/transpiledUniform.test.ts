import { describe, expect, it } from 'vitest';
import { ClampToEdgeWrapping, DataTexture, LinearMipmapLinearFilter, RepeatWrapping } from 'three';
import type { TextureNode } from 'three/webgpu';
import { textToVariant } from '../../godot/variant/reader/variantReader.js';
import { treeOf } from '../language/parsedTree.testkit.js';
import { GODOT_SAMPLING } from './samplerState.js';
import { bindParameters } from './transpiledUniform.js';

const parametersOf = (source: string) =>
  bindParameters(treeOf(source), { useLinearColor: false, sampling: GODOT_SAMPLING });

const sampledTexture = (source: string) => {
  const binding = parametersOf(source).get('s')!;
  const texture = new DataTexture(new Uint8Array(16), 2, 2);
  texture.mipmaps = [
    { data: new Uint8Array(16), width: 2, height: 2 },
    { data: new Uint8Array(4), width: 1, height: 1 },
  ];
  binding.set(texture);
  return (binding.value as TextureNode).value;
};

describe('bindParameters', () => {
  it("samples with the shader type's filter and repeat", () => {
    const copy = sampledTexture('shader_type spatial;\nuniform sampler2D s;');
    expect([copy.minFilter, copy.wrapS]).toEqual([LinearMipmapLinearFilter, RepeatWrapping]);
  });

  it("samples a text with no head as the probe harness's canvas_item", () => {
    expect(sampledTexture('uniform sampler2D s;').wrapS).toBe(ClampToEdgeWrapping);
  });

  it('reads white for a Variant on a sampler, which names no texture', () => {
    const binding = parametersOf('uniform sampler2D s : hint_default_black;').get('s')!;
    binding.set(textToVariant('1.5'));
    expect([...((binding.value as TextureNode).value as DataTexture).image.data!.slice(0, 4)]).toEqual([
      255, 255, 255, 255,
    ]);
  });

  it('refuses a texture on a uniform of a value type', () => {
    const binding = parametersOf('uniform float u;').get('u')!;
    expect(() => binding.set(new DataTexture())).toThrow('expected a Variant for u, got a texture');
  });

  it('cannot draw while a samplerExternalOES has no texture, where Godot builds no uniform set', () => {
    const external = parametersOf('uniform samplerExternalOES s;').get('s')!;
    const drawable = [external.isDrawable];
    external.set(new DataTexture(new Uint8Array(4), 1, 1));
    expect([...drawable, external.isDrawable]).toEqual([false, true]);
  });

  it('can draw with a sampler2D that has no texture, which reads its default', () => {
    expect(parametersOf('uniform sampler2D s;').get('s')!.isDrawable).toBe(true);
  });
});
