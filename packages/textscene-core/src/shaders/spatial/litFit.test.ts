import { describe, expect, it } from 'vitest';
import { generatedMaterialProgram } from '../generatedShader.testkit.js';
import { parsedShader } from '../language/parseShader.js';
import { MIN_SAMPLERS, MIN_UNIFORM_BLOCKS, samplersOf, uniformBlocksOf } from '../programLimits.testkit.js';
import { transpileParsedSpatial } from './transpileSpatial.js';

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
