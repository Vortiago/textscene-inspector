import * as THREE from 'three';
import type { NodeMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { transpileSky } from './transpileSky.js';
import { DEFAULT_SKY } from './defaultSky.testkit';

function errorOf(source: string): ShadingLanguageError {
  try {
    transpileSky(source, { file: 'user.gdshader' });
  } catch (error) {
    if (error instanceof ShadingLanguageError) return error;
    throw error;
  }
  throw new Error('expected a ShadingLanguageError, got none');
}

describe('transpileSky', () => {
  it('refuses a shader of another type, at its first line', () => {
    expect(errorOf('shader_type spatial;\n').position).toEqual({ file: 'user.gdshader', line: 1, column: 1 });
  });

  it("names the user's line for an error in the sky function", () => {
    const source = 'shader_type sky;\n\nvoid sky() {\n\tCOLOR = 1.0;\n}\n';
    expect(errorOf(source).position).toMatchObject({ file: 'user.gdshader', line: 4 });
  });

  it('writes no depth', () => {
    expect(transpileSky(DEFAULT_SKY).mesh.material.depthWrite).toBe(false);
  });

  it('tests depth, so it draws only where no surface drew', () => {
    expect(transpileSky(DEFAULT_SKY).mesh.material.depthTest).toBe(true);
  });

  it('draws after every opaque surface, as Godot draws the sky after its opaque pass', () => {
    expect(transpileSky(DEFAULT_SKY).mesh.renderOrder).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('draws no sky while a samplerExternalOES has no texture, as Godot draws none', () => {
    const source =
      'shader_type sky;\nuniform samplerExternalOES s;\nvoid sky() {\n\tCOLOR = texture(s, vec2(0.5)).rgb;\n}\n';
    expect((transpileSky(source).mesh.material as THREE.Material).visible).toBe(false);
  });

  it('draws no clone of the sky mesh while a samplerExternalOES has no texture', () => {
    const source =
      'shader_type sky;\nuniform samplerExternalOES s;\nvoid sky() {\n\tCOLOR = texture(s, vec2(0.5)).rgb;\n}\n';
    expect((transpileSky(source).mesh.clone().material as THREE.Material).visible).toBe(false);
  });

  it('gives one uniform for a member both stages read', () => {
    expect(transpileSky(DEFAULT_SKY).uniforms.has('params.orientation')).toBe(true);
  });

  it('reads a uniform of the material from its slot of bits', () => {
    const sky = transpileSky(
      'shader_type sky;\nuniform vec3 tint : source_color;\nvoid sky() { COLOR = tint; }'
    );
    expect([...sky.parameters.keys()]).toEqual(['tint']);
    expect(generatedFragmentShader((sky.mesh.material as NodeMaterial).fragmentNode!)).toMatch(
      /uvec4 \w+\[1\];/
    );
  });

  it("calls a built-in by its own name and a function of the shader by Godot's id", () => {
    const source =
      'shader_type sky;\nfloat half_of(float x) { return x * 0.5; }\nvoid sky() { COLOR = vec3(fract(half_of(TIME))); }';
    const fragment = (transpileSky(source).mesh.material as NodeMaterial).fragmentNode!;
    expect(generatedFragmentShader(fragment)).toMatch(/fract\(/);
  });

  it('gives equal GLSL for two runs of one text', () => {
    const fragmentOf = () =>
      generatedFragmentShader((transpileSky(DEFAULT_SKY).mesh.material as NodeMaterial).fragmentNode!);
    expect(fragmentOf()).toBe(fragmentOf());
  });
});
