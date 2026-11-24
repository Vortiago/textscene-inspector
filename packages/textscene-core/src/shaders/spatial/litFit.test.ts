import { describe, expect, it } from 'vitest';
import { generatedMaterialProgram } from '../generatedShader.testkit.js';
import { parsedShader } from '../language/parseShader.js';
import { transpileParsedSpatial } from './transpileSpatial.js';

/** WebGL 2's lowest `MAX_TEXTURE_IMAGE_UNITS` and `MAX_VERTEX_TEXTURE_IMAGE_UNITS`. */
const MIN_SAMPLERS = 16;

/** WebGL 2's lowest `MAX_FRAGMENT_UNIFORM_BLOCKS` and `MAX_VERTEX_UNIFORM_BLOCKS`. */
const MIN_UNIFORM_BLOCKS = 12;

/** A device's count, not SwiftShader's 32: the test counts the declarations, not a link. */
function samplersOf(stage: string): number {
  return stage.match(/^\s*uniform\s+[iu]?sampler\w+\s+\w+;/gm)?.length ?? 0;
}

function uniformBlocksOf(stage: string): number {
  return stage.match(/^\s*(?:layout\s*\([^)]*\)\s*)?uniform\s+\w+\s*\{/gm)?.length ?? 0;
}

describe('the lit colour pass of a spatial shader', () => {
  const program = generatedMaterialProgram(
    transpileParsedSpatial(
      parsedShader('shader_type spatial;\nvoid fragment() { ALBEDO = vec3(1.0); }\n', {})
    ).material
  );

  it('reads at most the 16 samplers WebGL 2 promises in the fragment stage', () => {
    expect(samplersOf(program.fragment)).toBeLessThanOrEqual(MIN_SAMPLERS);
  });

  it('reads at most the 12 uniform blocks WebGL 2 promises in the fragment stage', () => {
    expect(uniformBlocksOf(program.fragment)).toBeLessThanOrEqual(MIN_UNIFORM_BLOCKS);
  });

  it('reads at most the 16 samplers WebGL 2 promises in the vertex stage', () => {
    expect(samplersOf(program.vertex)).toBeLessThanOrEqual(MIN_SAMPLERS);
  });

  it('reads at most the 12 uniform blocks WebGL 2 promises in the vertex stage', () => {
    expect(uniformBlocksOf(program.vertex)).toBeLessThanOrEqual(MIN_UNIFORM_BLOCKS);
  });

  it('leaves a material 5 of the 16 fragment units', () => {
    expect(MIN_SAMPLERS - samplersOf(program.fragment)).toBe(5);
  });
});
