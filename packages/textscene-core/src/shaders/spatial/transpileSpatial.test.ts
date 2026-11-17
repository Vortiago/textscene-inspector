import type { NodeMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { generatedProgram } from '../generatedShader.testkit';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { transpileSpatial } from './transpileSpatial.js';

/** Godot's default spatial shader (`scene_shader_forward_clustered.cpp:910`), drawn unshaded. */
const DEFAULT_UNSHADED = `shader_type spatial;
render_mode unshaded;
void vertex() {
	ROUGHNESS = 0.8;
}
void fragment() {
	ALBEDO = vec3(0.6);
	ROUGHNESS = 0.8;
	METALLIC = 0.2;
}
`;

function errorOf(source: string): ShadingLanguageError {
  try {
    transpileSpatial(source, { file: 'user.gdshader' });
  } catch (error) {
    if (error instanceof ShadingLanguageError) return error;
    throw error;
  }
  throw new Error('expected a ShadingLanguageError, got none');
}

function program() {
  const material = transpileSpatial(DEFAULT_UNSHADED).material as unknown as NodeMaterial;
  return generatedProgram({
    vertexNode: material.vertexNode!,
    fragmentNode: material.fragmentNode!,
  } as never);
}

describe('transpileSpatial', () => {
  it('refuses a shader of another type, at its first line', () => {
    expect(errorOf('shader_type sky;\n').position).toEqual({ file: 'user.gdshader', line: 1, column: 1 });
  });

  it("refuses a built-in the slice does not draw yet, at the user's line", () => {
    const source = 'shader_type spatial;\nvoid fragment() {\n\tEMISSION = vec3(1.0);\n}\n';
    expect(errorOf(source).position).toMatchObject({ file: 'user.gdshader', line: 3 });
  });

  it('reads the instance from its row texture, with an integer sampler', () => {
    expect(program().vertex).toMatch(/uniform usampler2D \w+;/);
  });

  it('gives the scene data block one uniform per member, which both stages share', () => {
    const { uniforms } = transpileSpatial(DEFAULT_UNSHADED);
    expect(uniforms.has('scene_data_block.data.projection_matrix')).toBe(true);
    expect(uniforms.has('draw_call.instance_index')).toBe(true);
  });

  it('gives the instance buffer a row texture by its instance name', () => {
    expect(transpileSpatial(DEFAULT_UNSHADED).buffers.has('instances')).toBe(true);
  });
});
