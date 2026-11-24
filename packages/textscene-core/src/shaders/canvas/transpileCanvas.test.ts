import { describe, expect, it } from 'vitest';
import { generatedMaterialProgram } from '../generatedShader.testkit.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { samplersOf } from '../template/programLimits.testkit.js';
import {
  CANVAS_VARIANTS,
  DEFAULT_CANVAS_SHADER,
  specialiseCanvasDraw,
  transpileCanvasItem,
} from './transpileCanvas.js';

describe('transpileCanvasItem', () => {
  it.each(CANVAS_VARIANTS)("links Godot's default canvas shader into the %s variant", (variant) => {
    const { material } = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw(variant);

    const program = generatedMaterialProgram(material);

    expect(program.vertex).toContain('gl_Position');
    expect(program.fragment).not.toBe('');
  });

  it('refuses a shader of another type with the type it expects', () => {
    expect(() => transpileCanvasItem('shader_type spatial;\n')).toThrow(
      new ShadingLanguageError("expected a shader of 'shader_type canvas_item', found spatial", {
        file: '',
        line: 1,
        column: 1,
      })
    );
  });

  it('reads the light atlas, the shadow atlas and the light rows once the draw is lit', () => {
    const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');
    const unlit = samplersOf(generatedMaterialProgram(draw.material).fragment);

    specialiseCanvasDraw(draw, { useLighting: true });

    expect(samplersOf(generatedMaterialProgram(draw.material).fragment)).toBe(unlit + 3);
  });

  it('builds one material for each variant, however often it is asked for', () => {
    const item = transpileCanvasItem(DEFAULT_CANVAS_SHADER);

    expect(item.draw('attributes')).toBe(item.draw('attributes'));
  });
});
