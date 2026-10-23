import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { snapshotShaderGlobals } from './shaderPatches';

describe('snapshotShaderGlobals', () => {
  it('removes a chunk that a patch added', () => {
    const restore = snapshotShaderGlobals();
    Object.assign(THREE.ShaderChunk, { godot_added_chunk: 'added' });
    restore();
    expect('godot_added_chunk' in THREE.ShaderChunk).toBe(false);
  });

  it('restores the vertex shader of a program', () => {
    const original = THREE.ShaderLib.basic.vertexShader;
    const restore = snapshotShaderGlobals();
    THREE.ShaderLib.basic.vertexShader = 'patched';
    restore();
    expect(THREE.ShaderLib.basic.vertexShader).toBe(original);
  });

  it('removes a program that a patch added', () => {
    const restore = snapshotShaderGlobals();
    Object.assign(THREE.ShaderLib, {
      godotAddedProgram: { uniforms: {}, vertexShader: '', fragmentShader: '' },
    });
    restore();
    expect('godotAddedProgram' in THREE.ShaderLib).toBe(false);
  });

  it('removes a uniform that a patch added to any group of UniformsLib', () => {
    const restore = snapshotShaderGlobals();
    Object.assign(THREE.UniformsLib.common, { godotAddedUniform: { value: 1 } });
    restore();
    expect('godotAddedUniform' in THREE.UniformsLib.common).toBe(false);
  });
});
