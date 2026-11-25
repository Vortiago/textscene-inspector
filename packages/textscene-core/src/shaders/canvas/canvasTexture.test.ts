import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { CanvasTextureBinding, GODOT_CANVAS_TEXTURE_STATE } from './canvasTexture.js';
import { DEFAULT_CANVAS_SHADER, transpileCanvasItem } from './transpileCanvas.js';

function bound() {
  const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');
  const binding = new CanvasTextureBinding(draw);
  const texture = (name: string) => draw.textures.get(name)!.value as THREE.Texture;
  const param = (member: string) => (draw.uniforms.get(`params.${member}`) as UniformNode<unknown>).value;
  return { binding, texture, param };
}

const texture8x4 = () => new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);

describe('CanvasTextureBinding', () => {
  it("binds Godot's white default texture for a rect with no texture", () => {
    const { binding, texture, param } = bound();

    binding.bind(undefined, GODOT_CANVAS_TEXTURE_STATE);

    expect([
      [...(texture('color_texture').image.data as Uint8Array).slice(0, 4)],
      param('color_texture_pixel_size'),
    ]).toEqual([[255, 255, 255, 255], new THREE.Vector2(1 / 4, 1 / 4)]);
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

    const firstTexel = (name: string) => [...(texture(name).image.data as Uint8Array).slice(0, 4)];
    expect([
      firstTexel('normal_texture'),
      firstTexel('specular_texture'),
      param('specular_shininess'),
    ]).toEqual([[128, 128, 255, 255], [255, 255, 255, 255], 0xffffffff]);
  });
});
