import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { real, variant } from '../../godot/variant/value/variant';
import type { ScopedReference } from '../../resources/reading';
import { surfaceShaderOf } from './surfaceShader';

const reference = { ref: 'SubResource("map")' } as ScopedReference;

const baseMaterial = (properties: Record<string, string>, resources: Record<string, ScopedReference> = {}) =>
  surfaceShaderOf({
    baseMaterial: { materialClass: 'StandardMaterial3D', address: null, properties, resources },
  });

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

    expect(shader.parametersWith({ map: texture }, new Map())).toEqual({ tint: real(0.5), map: texture });
  });

  it('reads one material once for the surfaces that share it', () => {
    const material = {
      materialClass: 'StandardMaterial3D',
      address: null,
      properties: {},
      resources: {},
    } as const;

    expect(surfaceShaderOf({ baseMaterial: material })).toBe(surfaceShaderOf({ baseMaterial: material }));
  });

  it("writes a StandardMaterial3D's shader and names its textures by their sampler", () => {
    const shader = baseMaterial({ roughness: '0.25' }, { normal_texture: reference, next_pass: reference });

    expect(shader.code).toContain('shader_type spatial;');
    expect(shader.textures).toEqual({ texture_normal: reference });
    expect(shader.parametersWith({}, new Map()).roughness).toEqual(real(0.25));
  });

  it('gives the albedo texture the size its texture reports, not its sheet', () => {
    const sheet = new THREE.Texture({ width: 128, height: 128 });

    const slots = new Map([
      ['texture_albedo', { texture: sheet, isArriving: false, reportedSize: { width: 64, height: 32 } }],
    ]);

    const parameters = baseMaterial({}).parametersWith({ texture_albedo: sheet }, slots);

    expect(parameters.albedo_texture_size).toEqual(variant('VECTOR2I', { x: 64, y: 32 }));
  });

  it('gives no albedo size before the albedo texture reports one', () => {
    expect(baseMaterial({}).parametersWith({}, new Map())).not.toHaveProperty('albedo_texture_size');
  });

  it('names the material file in a fault', () => {
    const material = {
      materialClass: 'ORMMaterial3D',
      address: 'res://rock.tres',
      properties: {},
      resources: {},
    } as const;

    expect(surfaceShaderOf({ baseMaterial: material }).file).toBe('res://rock.tres');
  });

  it('names the class in a fault for a material built into a scene', () => {
    expect(baseMaterial({}).file).toBe('StandardMaterial3D');
  });

  it("names Godot's default material as a shader Godot generates", () => {
    const text = {
      code: 'shader_type spatial;',
      file: 'the default 3D material',
      parameters: {},
      textures: {},
    };

    expect(surfaceShaderOf({ defaultMaterial: text }).generatedFor).toBe('default material');
  });
});
