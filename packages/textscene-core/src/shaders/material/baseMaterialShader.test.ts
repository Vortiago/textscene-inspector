import { describe, expect, it, vi } from 'vitest';
import { real } from '../../godot/variant/value/variant.js';
import { baseMaterialSurface, CACHED_TEXTS } from './baseMaterialShader.js';
import * as renderModes from './renderModes.js';

vi.mock('./renderModes.js', { spy: true });

const NO_TEXTURES = {};
const codeOf = (materialClass: 'StandardMaterial3D' | 'ORMMaterial3D', properties: Record<string, string>) =>
  baseMaterialSurface(materialClass, properties, NO_TEXTURES).code;
const writes = () => vi.mocked(renderModes.renderModes).mock.calls.length;

describe('baseMaterialSurface', () => {
  it('writes one text for one key, as Godot caches one shader per material key', () => {
    const first = codeOf('StandardMaterial3D', { rim_enabled: 'true', rim: '0.2' });
    const before = writes();

    const second = codeOf('StandardMaterial3D', { rim_enabled: 'true', rim: '0.9' });

    expect(second).toBe(first);
    expect(writes()).toBe(before);
  });

  it('writes another text for another key', () => {
    const rim = codeOf('StandardMaterial3D', { rim_enabled: 'true' });

    expect(codeOf('ORMMaterial3D', { rim_enabled: 'true' })).not.toBe(rim);
  });

  it('writes a key again once more than the bound of other keys were read after it', () => {
    codeOf('StandardMaterial3D', { clearcoat_enabled: 'true' });
    for (let cullMode = 0; cullMode < CACHED_TEXTS; cullMode++)
      codeOf('StandardMaterial3D', { cull_mode: String(cullMode + 10), stencil_reference: String(cullMode) });
    const before = writes();

    codeOf('StandardMaterial3D', { clearcoat_enabled: 'true' });

    expect(writes()).toBe(before + 1);
  });

  it("writes nothing for an enum value Godot's switch has no case for", () => {
    const text = codeOf('StandardMaterial3D', { blend_mode: '9', cull_mode: '9' });

    expect(text).toContain('render_mode , depth_draw_opaque, diffuse_burley');
  });

  it('writes no filter for a texture filter past the last one, as Godot does', () => {
    const text = codeOf('StandardMaterial3D', { texture_filter: '6' });

    expect(text).toContain('uniform sampler2D texture_albedo : source_color, , repeat_enable;');
  });

  it("gives each parameter the value the material's file sets", () => {
    const { parameters } = baseMaterialSurface('StandardMaterial3D', { roughness: '0.25' }, NO_TEXTURES);

    expect(parameters.roughness).toEqual(real(0.25));
  });

  it('names each texture by its sampler parameter', () => {
    const albedo = { name: 'albedo' };

    const { textures } = baseMaterialSurface('StandardMaterial3D', {}, { albedo_texture: albedo });

    expect(textures).toEqual({ texture_albedo: albedo });
  });
});
