import { describe, expect, it } from 'vitest';
import { generatedMaterialProgram } from '../generatedShader.testkit.js';
import {
  MIN_SAMPLERS,
  MIN_UNIFORM_BLOCKS,
  samplersOf,
  uniformBlocksOf,
} from '../template/programLimits.testkit.js';
import { DEFAULT_CANVAS_SHADER } from './defaultCanvasShader.js';
import {
  CANVAS_VARIANTS,
  specialiseCanvasDraw,
  transpileCanvasItem,
  type CanvasVariant,
} from './transpileCanvas.js';

/** Both stages of each variant, from one item for each lighting: a draw keeps its specialisation. */
function programsOf(useLighting: boolean): ReadonlyMap<CanvasVariant, { vertex: string; fragment: string }> {
  const item = transpileCanvasItem(DEFAULT_CANVAS_SHADER);
  return new Map(
    CANVAS_VARIANTS.map((variant) => {
      const draw = item.draw(variant);
      specialiseCanvasDraw(draw, { useLighting });
      return [variant, generatedMaterialProgram(draw.material)];
    })
  );
}

const PROGRAMS = { unlit: programsOf(false), lit: programsOf(true) };

describe.each(CANVAS_VARIANTS.flatMap((variant) => [[variant, 'unlit'] as const, [variant, 'lit'] as const]))(
  'the %s variant of the canvas template, %s',
  (variant, lighting) => {
    const program = PROGRAMS[lighting].get(variant)!;

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
  const program = PROGRAMS.lit.get('quad')!;

  it('leaves a material 10 of the 16 fragment units', () => {
    expect(MIN_SAMPLERS - samplersOf(program.fragment)).toBe(10);
  });

  it('leaves a material 11 of the 12 fragment uniform blocks', () => {
    expect(MIN_UNIFORM_BLOCKS - uniformBlocksOf(program.fragment)).toBe(11);
  });
  it('tests no light for a shadow, so SwiftShader compiles it in seconds, not minutes', () => {
    const hasShadowBit = `${1 << 20}u`;
    expect(program.fragment).not.toContain(hasShadowBit);
  });
});

describe('the lit attributes variant, which reads the instance transforms in its vertex stage', () => {
  it('leaves a material 15 of the 16 vertex units', () => {
    expect(MIN_SAMPLERS - samplersOf(PROGRAMS.lit.get('attributes')!.vertex)).toBe(15);
  });
});
