import type { NodeMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedFragmentShader } from '../generatedShader.testkit';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { transpileSky } from './transpileSky.js';

const DEFAULT_SKY = 'shader_type sky;\n\nvoid sky() {\n\tCOLOR = vec3(0.0);\n}\n';

function errorOf(source: string): ShadingLanguageError {
  try {
    transpileSky(source, 'user.gdshader');
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

  it('draws before the scene and writes no depth', () => {
    const material = transpileSky(DEFAULT_SKY).mesh.material as { depthWrite: boolean };
    expect(material.depthWrite).toBe(false);
  });

  it('gives one uniform for a member both stages read', () => {
    expect(transpileSky(DEFAULT_SKY).uniforms.has('params.orientation')).toBe(true);
  });

  it('gives equal GLSL for two runs of one text', () => {
    const fragmentOf = () =>
      generatedFragmentShader((transpileSky(DEFAULT_SKY).mesh.material as NodeMaterial).fragmentNode!);
    expect(fragmentOf()).toBe(fragmentOf());
  });
});
