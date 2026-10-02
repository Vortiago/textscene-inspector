import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installLitUniform, installedUniformValue } from './litUniform';

const UNIFORM = 'litUniformTest';
const LIT_SHADERS = ['lambert', 'phong', 'standard', 'physical', 'toon', 'shadow'] as const;

afterEach(() => {
  for (const shader of Object.values(THREE.ShaderLib)) delete shader.uniforms[UNIFORM];
  delete (THREE.UniformsLib.lights as Record<string, THREE.IUniform>)[UNIFORM];
});

describe('installLitUniform', () => {
  it('gives every built-in material that merges three’s light uniforms the value', () => {
    const value = new Float32Array(1);
    installLitUniform(UNIFORM, value);
    for (const name of LIT_SHADERS) expect(THREE.ShaderLib[name]!.uniforms[UNIFORM]!.value).toBe(value);
  });

  it('shares the value with a ShaderMaterial that merges three’s light uniforms', () => {
    const value = new Float32Array(1);
    installLitUniform(UNIFORM, value);
    expect(THREE.UniformsUtils.merge([THREE.UniformsLib.lights])[UNIFORM]!.value).toBe(value);
  });

  it('leaves every unlit material alone (edge case)', () => {
    installLitUniform(UNIFORM, 1);
    const unlit = Object.entries(THREE.ShaderLib).filter(
      ([name]) => !(LIT_SHADERS as readonly string[]).includes(name)
    );
    for (const [, shader] of unlit) expect(shader.uniforms[UNIFORM]).toBeUndefined();
  });
});

describe('installedUniformValue', () => {
  it('reads the value an install gave the lit materials', () => {
    installLitUniform(UNIFORM, 7);
    expect(installedUniformValue(UNIFORM)).toBe(7);
  });

  it('is undefined before any install (edge case)', () => {
    expect(installedUniformValue(UNIFORM)).toBeUndefined();
  });
});
