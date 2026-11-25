import { describe, expect, it } from 'vitest';
import { materialSettingsOf } from './materialSettings.js';

describe('materialSettingsOf', () => {
  it('reads a bool, an int, a float, a colour and a vector from their text, in float32 lanes', () => {
    const settings = materialSettingsOf({
      clearcoat_enabled: 'true',
      diffuse_mode: '3',
      roughness: '0.25',
      albedo_color: 'Color(0.2, 0.4, 0.6, 0.8)',
      uv1_scale: 'Vector3(2, 3, 4)',
    });

    expect(settings).toEqual({
      clearcoat_enabled: true,
      diffuse_mode: 3,
      roughness: 0.25,
      albedo_color: [0.2, 0.4, 0.6, 0.8].map(Math.fround),
      uv1_scale: [2, 3, 4],
    });
  });

  it('keeps the order the file writes the properties in, which is the order Godot sets them', () => {
    const settings = materialSettingsOf({ stencil_flags: '2', stencil_mode: '1' });

    expect(Object.keys(settings)).toEqual(['stencil_flags', 'stencil_mode']);
  });

  it('leaves out a resource and a value no setter of the material takes', () => {
    const settings = materialSettingsOf({
      albedo_texture: 'ExtResource("1_tex")',
      resource_name: '"Rock"',
      roughness: '0.5',
    });

    expect(settings).toEqual({ roughness: 0.5 });
  });
});
