import type { Node, NodeMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { uniform, vec4 } from 'three/tsl';
import { generatedProgram, oneBackendBuilds } from '../generatedShader.testkit';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { transpileSpatial } from './transpileSpatial.js';
import {
  SOFT_LOW_PENUMBRA_SAMPLES,
  SOFT_LOW_SHADOW_SAMPLES,
} from '../../godot/rendering/lights/softShadowKernel.js';

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

function program(source = DEFAULT_UNSHADED) {
  const material = transpileSpatial(source).material as unknown as NodeMaterial;
  return generatedProgram({
    vertexNode: material.vertexNode!,
    fragmentNode: material.fragmentNode!,
    contextNode: material.contextNode,
  } as never);
}

describe('transpileSpatial', () => {
  it('refuses a shader of another type, at its first line', () => {
    expect(errorOf('shader_type sky;\n').position).toEqual({ file: 'user.gdshader', line: 1, column: 1 });
  });

  it("refuses a render mode the port does not draw yet, at the user's line", () => {
    const source = 'shader_type spatial;\nrender_mode vertex_lighting;\nvoid fragment() {}\n';
    expect(errorOf(source)).toMatchObject({ owner: '#1453', position: { file: 'user.gdshader', line: 2 } });
  });

  it("draws a lit shader through the scene template's light loop", () => {
    const lit = transpileSpatial(
      'shader_type spatial;\nvoid fragment() { ALBEDO = vec3(1.0); EMISSION = vec3(1.0); }\n'
    );
    expect(lit.uniforms.has('directional_lights.data.direction')).toBe(true);
  });

  it('reads the instance from its row texture, with an integer sampler', () => {
    expect(program().vertex).toMatch(/uniform usampler2D \w+;/);
  });

  it('gives the scene data block one uniform per member, which both stages share', () => {
    const { uniforms } = transpileSpatial(DEFAULT_UNSHADED);
    expect(uniforms.has('scene_data_block.data.projection_matrix')).toBe(true);
    expect(uniforms.has('draw_call.instance_index')).toBe(true);
  });

  it('writes DEPTH into GL’s depth, which is 1 minus Godot’s reversed depth', () => {
    const source = 'shader_type spatial;\nrender_mode unshaded;\nvoid fragment() {\n\tDEPTH = 0.25;\n}\n';
    expect(program(source).fragment).toMatch(/gl_FragDepth = \( 1\.0 - nodeVar\d+ \);/);
  });

  it('keeps gl_Position invariant, as the template declares, so the prepass depth matches', () => {
    expect(program().vertex).toContain('invariant gl_Position;');
  });

  it('writes no depth for a shader that does not name DEPTH', () => {
    expect(program().fragment).not.toContain('gl_FragDepth');
  });

  it('gives the instance buffer a row texture by its instance name', () => {
    expect(transpileSpatial(DEFAULT_UNSHADED).buffers.has('instances')).toBe(true);
  });

  it('cuts at alpha 0.5 under alpha to coverage, for a target of one sample', () => {
    const source =
      'shader_type spatial;\nrender_mode unshaded, alpha_to_coverage;\nvoid fragment() {\n\tALPHA = 0.3;\n}\n';
    expect(program(source).fragment).toMatch(/if \( \( nodeVar\d+\.w < 0\.5 \) \) \{\s+discard;/);
  });

  it('forces the alpha to 1 after the cut under alpha_to_coverage_and_one', () => {
    const source =
      'shader_type spatial;\nrender_mode unshaded, alpha_to_coverage_and_one;\nvoid fragment() {\n\tALPHA = 0.3;\n}\n';
    expect(program(source).fragment).toMatch(/discard;\s+\}\s+nodeVar\d+\.w = 1\.0;/);
  });
});

/** The `nodeUniformN` names a stage reads that it never declares. */
function undeclaredUniforms(stage: string): string[] {
  const declared = new Set(
    [...stage.matchAll(/(?:uniform\s+\w+|^\s+\w+)\s+(nodeUniform\d+)\s*(?:\[\s*\d+\s*\])?;/gm)].map(
      (declaration) => declaration[1]
    )
  );
  const read = new Set([...stage.matchAll(/\bnodeUniform\d+\b/g)].map((reading) => reading[0]));
  return [...read].filter((name) => !declared.has(name));
}

describe("a transpiled spatial material's first program", () => {
  it("keys Godot's default shadow quality before the first draw, so the first draw keeps its program", () => {
    const material = transpileSpatial(
      'shader_type spatial;\nvoid fragment() { ALBEDO = vec3(0.5); }'
    ).material;
    const [taps, penumbra] = [SOFT_LOW_SHADOW_SAMPLES, SOFT_LOW_PENUMBRA_SAMPLES];
    const softLow = (taps << 8) | (penumbra << 14) | (taps << 20) | (penumbra << 26);

    expect(material.customProgramCacheKey().split('|').at(-1)!.split(',')).toContain(String(softLow >>> 0));
  });
});

describe('a transpiled spatial material built into two programs', () => {
  it('declares every uniform its functions read in the second program too', () => {
    const { material } = transpileSpatial(
      'shader_type spatial;\nvoid fragment() {\n\tALBEDO = vec3(0.6);\n}\n'
    );
    const build = oneBackendBuilds();
    build(material);
    // A uniform read first renumbers every uniform after it, as three's own nodes of a scene do.
    const colour = material.fragmentNode as unknown as ReturnType<typeof vec4>;
    material.fragmentNode = vec4(uniform(0.5).add(colour.xyz), colour.w) as unknown as Node;
    expect(undeclaredUniforms(build(material).fragment)).toEqual([]);
  });
});
