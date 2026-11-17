import { describe, expect, it } from 'vitest';
import {
  CubeTexture,
  Data3DTexture,
  DataArrayTexture,
  DataTexture,
  LinearMipmapLinearFilter,
  NearestFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';
import type { TextureNode } from 'three/webgpu';
import { NIL } from '../../godot/variant/value/variant.js';
import { treeOf } from '../language/parsedTree.testkit.js';
import type { ArrayValue } from '../language/emitValue.js';
import { GODOT_SAMPLING } from './samplerState.js';
import { SAMPLER_DEFAULTS } from './samplerTextures.js';
import { SamplerBinding } from './samplerUniform.js';

const bindingOf = (declaration: string, useLinearColor = false) =>
  new SamplerBinding(treeOf(declaration).uniforms[0]!, {
    defaults: SAMPLER_DEFAULTS.spatial!,
    sampling: GODOT_SAMPLING,
    useLinearColor,
  });

const textureOf = (binding: SamplerBinding): Texture => (binding.value as TextureNode).value;

const imageTexture = () => {
  const texture = new DataTexture(new Uint8Array(16), 2, 2);
  texture.flipY = true;
  return texture;
};

describe('SamplerBinding', () => {
  it('reads a copy of the material texture that shares its image', () => {
    const binding = bindingOf('uniform sampler2D s;');
    const texture = imageTexture();
    binding.set(texture);
    expect(textureOf(binding)).not.toBe(texture);
    expect(textureOf(binding).image).toBe(texture.image);
  });

  it("reads the image with Godot's top-left origin", () => {
    const binding = bindingOf('uniform sampler2D s;');
    binding.set(imageTexture());
    expect(textureOf(binding).flipY).toBe(false);
  });

  it('gives the copy the filter and repeat of the declaration', () => {
    const binding = bindingOf('uniform sampler2D s : filter_nearest;');
    binding.set(imageTexture());
    const copy = textureOf(binding);
    expect([copy.magFilter, copy.minFilter, copy.wrapS, copy.wrapT]).toEqual([
      NearestFilter,
      NearestFilter,
      RepeatWrapping,
      RepeatWrapping,
    ]);
  });

  it('reads the mip levels the texture holds', () => {
    const texture = imageTexture();
    texture.mipmaps = [
      { data: new Uint8Array(16), width: 2, height: 2 },
      { data: new Uint8Array(4), width: 1, height: 1 },
    ];
    const binding = bindingOf('uniform sampler2D s;');
    binding.set(texture);
    expect(textureOf(binding).minFilter).toBe(LinearMipmapLinearFilter);
  });

  it('reads a cube array as a 2D array of six layers to a cube', () => {
    const binding = bindingOf('uniform samplerCubeArray s;');
    expect((textureOf(binding) as DataArrayTexture).image.depth).toBe(6);
  });

  it('keeps one copy while the material texture stays the same', () => {
    const binding = bindingOf('uniform sampler2D s;');
    const texture = imageTexture();
    binding.set(texture);
    const first = textureOf(binding);
    binding.set(texture);
    expect(textureOf(binding)).toBe(first);
  });

  it('frees the copy of a texture the material replaces', () => {
    const binding = bindingOf('uniform sampler2D s;');
    binding.set(imageTexture());
    let disposals = 0;
    textureOf(binding).addEventListener('dispose', () => disposals++);
    binding.set(imageTexture());
    expect(disposals).toBe(1);
  });

  it('decodes a source colour texture from sRGB only where the material is linear', () => {
    const linear = bindingOf('uniform sampler2D s : source_color;', true);
    const stored = bindingOf('uniform sampler2D s : source_color;', false);
    linear.set(imageTexture());
    stored.set(imageTexture());
    expect([textureOf(linear).colorSpace, textureOf(stored).colorSpace]).toEqual([
      SRGBColorSpace,
      NoColorSpace,
    ]);
  });

  it('reads the 4 by 4 default of the hint while the material sets no texture', () => {
    const binding = bindingOf('uniform sampler2D s : hint_normal;');
    const texture = textureOf(binding) as DataTexture;
    expect([texture.image.width, texture.image.height, ...texture.image.data!.slice(0, 4)]).toEqual([
      4, 4, 128, 128, 255, 255,
    ]);
  });

  it.each([
    ['null', null],
    ['NIL', NIL],
  ])('reads the default of the hint for %s, which erases the value', (_, value) => {
    const binding = bindingOf('uniform sampler2D s : hint_default_black;');
    binding.set(imageTexture());
    binding.set(value);
    expect([...(textureOf(binding) as DataTexture).image.data!.slice(0, 4)]).toEqual([0, 0, 0, 255]);
  });

  it.each([
    ['samplerCube', CubeTexture],
    ['sampler3D', Data3DTexture],
    ['sampler2DArray', DataArrayTexture],
  ])('gives a %s default its own kind of texture', (type, kind) => {
    expect(textureOf(bindingOf(`uniform ${type} s;`))).toBeInstanceOf(kind);
  });

  it('gives an array uniform one texture node per element', () => {
    const binding = bindingOf('uniform sampler2D s[2];');
    const texture = imageTexture();
    binding.set([texture]);
    const elements = binding.value as ArrayValue;
    const [first, second] = [0, 1].map((index) => (elements.element(index) as TextureNode).value);
    expect([elements.count, first!.image, second!.image]).toEqual([2, texture.image, texture.image]);
  });
});
