import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MATERIAL_ALBEDO,
  DEFAULT_MATERIAL_METALLIC,
  DEFAULT_MATERIAL_ROUGHNESS,
  SHADER_ALPHA_HASH_SCALE_DEFAULT,
} from './defaultMaterial';

/** The hardcoded default material shader (`scene_shader_forward_clustered.cpp:905-925`). */
describe('the default 3D material', () => {
  it('writes ALBEDO = vec3(0.6)', () => {
    expect(DEFAULT_MATERIAL_ALBEDO).toBe(0.6);
  });

  it('writes ROUGHNESS = 0.8', () => {
    expect(DEFAULT_MATERIAL_ROUGHNESS).toBe(0.8);
  });

  it('writes METALLIC = 0.2', () => {
    expect(DEFAULT_MATERIAL_METALLIC).toBe(0.2);
  });

  it('hashes at scale 1 where no material sets ALPHA_HASH_SCALE (scene_forward_clustered.glsl:1303)', () => {
    expect(SHADER_ALPHA_HASH_SCALE_DEFAULT).toBe(1);
  });
});
