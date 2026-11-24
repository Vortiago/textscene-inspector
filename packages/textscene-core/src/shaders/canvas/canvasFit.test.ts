import { describe, expect, it } from 'vitest';
import { generatedMaterialProgram } from '../generatedShader.testkit.js';
import {
  MIN_SAMPLERS,
  MIN_UNIFORM_BLOCKS,
  samplersOf,
  uniformBlocksOf,
} from '../template/programLimits.testkit.js';
import {
  CANVAS_VARIANTS,
  specialiseCanvasDraw,
  transpileCanvasItem,
  type CanvasVariant,
} from './transpileCanvas.js';

function programOf(variant: CanvasVariant, useLighting: boolean) {
  const draw = transpileCanvasItem('shader_type canvas_item;\n').draw(variant);
  specialiseCanvasDraw(draw, { useLighting });
  return generatedMaterialProgram(draw.material);
}

describe.each(CANVAS_VARIANTS.flatMap((variant) => [[variant, false] as const, [variant, true] as const]))(
  'the %s variant of the canvas template, lit %s',
  (variant, useLighting) => {
    const program = programOf(variant, useLighting);

    it('reads at most the 16 samplers WebGL 2 promises in each stage', () => {
      expect(samplersOf(program.vertex)).toBeLessThanOrEqual(MIN_SAMPLERS);
      expect(samplersOf(program.fragment)).toBeLessThanOrEqual(MIN_SAMPLERS);
    });

    it('reads at most the 12 uniform blocks WebGL 2 promises in each stage', () => {
      expect(uniformBlocksOf(program.vertex)).toBeLessThanOrEqual(MIN_UNIFORM_BLOCKS);
      expect(uniformBlocksOf(program.fragment)).toBeLessThanOrEqual(MIN_UNIFORM_BLOCKS);
    });
  }
);

describe("the lit quad, which a user's canvas_item shader adds its textures to", () => {
  const program = programOf('quad', true);

  it('leaves a material 10 of the 16 fragment units', () => {
    expect(MIN_SAMPLERS - samplersOf(program.fragment)).toBe(10);
  });

  it('leaves a material 11 of the 12 fragment uniform blocks', () => {
    expect(MIN_UNIFORM_BLOCKS - uniformBlocksOf(program.fragment)).toBe(11);
  });
});

describe('the lit attributes variant, which reads the instance transforms in its vertex stage', () => {
  const program = programOf('attributes', true);

  it('leaves a material 15 of the 16 vertex units', () => {
    expect(MIN_SAMPLERS - samplersOf(program.vertex)).toBe(15);
  });
});
