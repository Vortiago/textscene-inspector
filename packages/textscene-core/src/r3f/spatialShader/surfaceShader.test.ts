import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { real, variant } from '../../godot/variant/value/variant';
import type { ScopedReference } from '../../resources/reading';
import { surfaceShaderOf } from './surfaceShader';

const reference = { ref: 'SubResource("map")' } as ScopedReference;

const baseMaterial = (properties: Record<string, string>, resources: Record<string, ScopedReference> = {}) =>
  surfaceShaderOf({ baseMaterial: { materialClass: 'StandardMaterial3D', properties, resources } });

describe('surfaceShaderOf', () => {
  it("reads a ShaderMaterial's parameters from their text, and adds its textures as they load", () => {
    const texture = new THREE.Texture();
    const shader = surfaceShaderOf({
      shader: {
        code: 'shader_type spatial;',
        file: 'res://a.gdshader',
        parameters: { tint: '0.5' },
        textures: {},
      },
    });

    expect(shader.parametersWith({ map: texture })).toEqual({ tint: real(0.5), map: texture });
  });

  it("writes a StandardMaterial3D's shader and names its textures by their sampler", () => {
    const shader = baseMaterial({ roughness: '0.25' }, { normal_texture: reference, next_pass: reference });

    expect(shader.code).toContain('shader_type spatial;');
    expect(shader.textures).toEqual({ texture_normal: reference });
    expect(shader.parametersWith({}).roughness).toEqual(real(0.25));
  });

  it('gives the albedo texture its size once it loads', () => {
    const albedo = new THREE.Texture({ width: 64, height: 32 });

    const parameters = baseMaterial({}).parametersWith({ texture_albedo: albedo });

    expect(parameters.albedo_texture_size).toEqual(variant('VECTOR2I', { x: 64, y: 32 }));
  });

  it('gives no albedo size before the albedo texture loads', () => {
    expect(baseMaterial({}).parametersWith({})).not.toHaveProperty('albedo_texture_size');
  });
});
