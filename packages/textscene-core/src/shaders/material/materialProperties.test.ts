import { describe, expect, it } from 'vitest';
import { BlendMode } from '../../godot/rendering/materials/blendMode.js';
import { MaterialFeature, MaterialFlag } from '../../godot/rendering/materials/materialFeatures.js';
import { StencilCompare, StencilFlag, StencilMode } from '../../godot/rendering/materials/stencil.js';
import { TextureChannel } from '../../godot/rendering/materials/textureChannel.js';
import { materialStateOf } from './materialProperties.js';

describe('materialStateOf', () => {
  it('writes a feature, a flag and an enum into the key', () => {
    const { key } = materialStateOf('StandardMaterial3D', {
      rim_enabled: true,
      uv1_triplanar: true,
      blend_mode: BlendMode.ADD,
    });

    expect([key.features.has(MaterialFeature.RIM), key.flags.has(MaterialFlag.UV1_USE_TRIPLANAR)]).toEqual([
      true,
      true,
    ]);
    expect(key.blendMode).toBe(BlendMode.ADD);
  });

  it('keeps a property the key does not hold among the values', () => {
    const { values } = materialStateOf('StandardMaterial3D', { roughness: 0.25, constructor: 1 });

    expect(values).toEqual({ roughness: 0.25, constructor: 1 });
  });

  it('sets the orm bit for an ORMMaterial3D only', () => {
    expect(materialStateOf('ORMMaterial3D', {}).key.orm).toBe(true);
    expect(materialStateOf('StandardMaterial3D', {}).key.orm).toBe(false);
  });

  it('clears a flag a later setting turns off', () => {
    const { key } = materialStateOf('StandardMaterial3D', { texture_repeat: false });

    expect(key.flags.has(MaterialFlag.USE_TEXTURE_REPEAT)).toBe(false);
  });

  it('makes an outline write the stencil, always, as set_stencil_mode does', () => {
    const { key } = materialStateOf('StandardMaterial3D', { stencil_mode: StencilMode.OUTLINE });

    expect([key.stencilFlags, key.stencilCompare]).toEqual([StencilFlag.WRITE, StencilCompare.ALWAYS]);
  });

  it('runs the setters in order, so flags set after the mode replace its write', () => {
    const { key } = materialStateOf('StandardMaterial3D', {
      stencil_mode: StencilMode.XRAY,
      stencil_flags: StencilFlag.READ,
    });

    expect(key.stencilFlags).toBe(StencilFlag.READ);
  });

  it('ignores a roughness channel that is not a channel, as Godot does', () => {
    const { key } = materialStateOf('StandardMaterial3D', { roughness_texture_channel: 9 });

    expect(key.roughnessTextureChannel).toBe(TextureChannel.TEXTURE_CHANNEL_RED);
  });

  it.each([Number.NaN, Infinity, -Infinity])(
    'turns a feature, a flag and a bool on for %s, which is not zero',
    (value) => {
      const { key } = materialStateOf('StandardMaterial3D', {
        rim_enabled: value,
        uv1_triplanar: value,
        grow: value,
      });

      expect([
        key.features.has(MaterialFeature.RIM),
        key.flags.has(MaterialFlag.UV1_USE_TRIPLANAR),
        key.grow,
      ]).toEqual([true, true, true]);
    }
  );

  it.each([Number.NaN, Infinity, -Infinity])(
    'casts an enum of %s to the lowest int32, as the Variant does',
    (value) => {
      const { key } = materialStateOf('StandardMaterial3D', { blend_mode: value, stencil_reference: value });

      expect([key.blendMode, key.stencilReference]).toEqual([-2147483648, -2147483648]);
    }
  );
});
