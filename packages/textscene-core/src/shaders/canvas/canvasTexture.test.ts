import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { CanvasTextureBinding, GODOT_CANVAS_TEXTURE_STATE } from './canvasTexture.js';
import { WHITE } from './canvasInstance.js';
import { DEFAULT_CANVAS_SHADER, transpileCanvasItem } from './transpileCanvas.js';

function bound() {
  const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');
  const binding = new CanvasTextureBinding(draw);
  const texture = (name: string) => draw.textures.get(name)!.value as THREE.Texture;
  const param = (member: string) => (draw.uniforms.get(`params.${member}`) as UniformNode<unknown>).value;
  return { binding, texture, param };
}

/** The first texel of a data texture. */
const firstTexel = (texture: THREE.Texture) => [...(texture.image as { data: Uint8Array }).data.slice(0, 4)];

const texture8x4 = () => new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);

describe('CanvasTextureBinding', () => {
  it("binds Godot's white default texture for a rect with no texture", () => {
    const { binding, texture } = bound();

    binding.bind(undefined, GODOT_CANVAS_TEXTURE_STATE);

    expect(firstTexel(texture('color_texture'))).toEqual([255, 255, 255, 255]);
  });

  it('writes a texel size of 1 for no texture and returns none, as the default canvas texture has no diffuse size', () => {
    const { binding, param } = bound();

    const texelSize = binding.bind(undefined, GODOT_CANVAS_TEXTURE_STATE);

    expect([param('color_texture_pixel_size'), texelSize]).toEqual([new THREE.Vector2(1, 1), undefined]);
  });

  it('returns the texel size it writes', () => {
    const { binding } = bound();

    expect(binding.bind(texture8x4(), GODOT_CANVAS_TEXTURE_STATE)).toEqual({ x: 1 / 8, y: 1 / 4 });
  });

  it.each([
    [false, THREE.NoColorSpace],
    [true, THREE.SRGBColorSpace],
  ])('reads the texture of a render target with linear colours %s in %s', (usesLinearColors, colorSpace) => {
    const { binding, texture } = bound();

    binding.bind(texture8x4(), { ...GODOT_CANVAS_TEXTURE_STATE, usesLinearColors });

    expect(texture('color_texture').colorSpace).toBe(colorSpace);
  });

  it("writes the texture's texel size", () => {
    const { binding, param } = bound();

    binding.bind(texture8x4(), GODOT_CANVAS_TEXTURE_STATE);

    expect(param('color_texture_pixel_size')).toEqual(new THREE.Vector2(1 / 8, 1 / 4));
  });

  it('refuses a texture whose image has not loaded, as its texel size is unknown', () => {
    const { binding } = bound();

    expect(() => binding.bind(new THREE.Texture(), GODOT_CANVAS_TEXTURE_STATE)).toThrow(/no by no texels/);
  });

  it("binds a copy of the texture with the item's filter and repeat, read as stored", () => {
    const { binding, texture } = bound();
    const source = texture8x4();

    binding.bind(source, { filter: 'nearest', repeat: 'mirror' });

    const copy = texture('color_texture');
    expect([copy === source, copy.magFilter, copy.wrapS, copy.wrapT, copy.colorSpace]).toEqual([
      false,
      THREE.NearestFilter,
      THREE.MirroredRepeatWrapping,
      THREE.MirroredRepeatWrapping,
      THREE.NoColorSpace,
    ]);
  });

  it('binds a new copy when the sampler changes, and frees the old one', () => {
    const { binding, texture } = bound();
    const source = texture8x4();
    binding.bind(source, { filter: 'nearest', repeat: 'disabled' });
    const nearest = texture('color_texture');
    let isFreed = false;
    nearest.addEventListener('dispose', () => (isFreed = true));

    binding.bind(source, { filter: 'linear', repeat: 'disabled' });

    expect([texture('color_texture').magFilter, isFreed]).toEqual([THREE.LinearFilter, true]);
  });

  it("binds Godot's default normal and white specular textures and the white specular colour", () => {
    const { binding, texture, param } = bound();

    binding.bind(texture8x4(), GODOT_CANVAS_TEXTURE_STATE);

    expect([
      firstTexel(texture('normal_texture')),
      firstTexel(texture('specular_texture')),
      param('specular_shininess'),
    ]).toEqual([[128, 128, 255, 255], [255, 255, 255, 255], 0xffffffff]);
  });

  it("binds a CanvasTexture's normal and specular maps raw, with the item's sampler", () => {
    const { binding, texture } = bound();
    const normal = texture8x4();
    const specular = texture8x4();

    binding.bind(
      texture8x4(),
      { filter: 'nearest', repeat: 'mirror', usesLinearColors: true },
      { normal, specular, specularShininess: WHITE }
    );

    const read = (name: string) => {
      const copy = texture(name);
      return [
        copy.source === normal.source || copy.source === specular.source,
        copy.magFilter,
        copy.wrapS,
        copy.colorSpace,
      ];
    };
    expect([read('normal_texture'), read('specular_texture')]).toEqual([
      [false, THREE.NearestFilter, THREE.MirroredRepeatWrapping, THREE.NoColorSpace],
      [false, THREE.NearestFilter, THREE.MirroredRepeatWrapping, THREE.NoColorSpace],
    ]);
  });

  it('packs the specular colour and shininess as unorm8, truncated as Godot casts them', () => {
    const { binding, param } = bound();

    binding.bind(texture8x4(), GODOT_CANVAS_TEXTURE_STATE, {
      normal: null,
      specular: null,
      specularShininess: { r: 0.5, g: 0.25, b: 1, a: 0.1 },
    });

    expect(param('specular_shininess')).toBe(((25 << 24) | (255 << 16) | (63 << 8) | 127) >>> 0);
  });

  it.each([
    ['no map', { normal: null, specularShininess: WHITE }, 0],
    ['a normal map', { normal: texture8x4(), specularShininess: WHITE }, 1 << 9],
    ['a shininess under 0.999', { normal: null, specularShininess: { ...WHITE, a: 0.5 } }, 1 << 10],
  ])('sets the default map flags for %s', (_, maps, flags) => {
    const { binding, param } = bound();

    binding.bind(texture8x4(), GODOT_CANVAS_TEXTURE_STATE, { specular: null, ...maps });

    expect(param('batch_flags')).toBe(flags);
  });
});
