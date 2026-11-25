import * as THREE from 'three';
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

  it('keeps the msdf and lcd bits of the packed word when it sets lighting', () => {
    const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');
    const packed = draw.specialisations.get('pso_sc_packed_0')!;
    packed.value = 0b110;

    specialiseCanvasDraw(draw, { useLighting: true });

    expect(packed.value).toBe(0b111);
  });

  it('reads the unlit samplers again once the draw is unlit again', () => {
    const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');
    const unlit = samplersOf(generatedMaterialProgram(draw.material).fragment);
    specialiseCanvasDraw(draw, { useLighting: true });

    specialiseCanvasDraw(draw, { useLighting: false });

    expect(samplersOf(generatedMaterialProgram(draw.material).fragment)).toBe(unlit);
  });

  it('refuses a draw whose template has no packed specialisation', () => {
    const draw = { ...transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad'), specialisations: new Map() };

    expect(() => specialiseCanvasDraw(draw, { useLighting: true })).toThrow(
      'expected the specialisation constant pso_sc_packed_0 in the canvas template, found none'
    );
  });

  it("blends as Godot's blend_mix and culls no face, as Godot's canvas pipeline does", () => {
    const { material } = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');

    expect([material.blending, material.transparent, material.side, material.forceSinglePass]).toEqual([
      THREE.NormalBlending,
      true,
      THREE.DoubleSide,
      true,
    ]);
  });

  it("draws with no depth test and no depth write, as Godot's canvas pipeline does", () => {
    const { material } = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');

    expect([material.depthTest, material.depthWrite]).toEqual([false, false]);
  });

  it('builds one material for each variant, however often it is asked for', () => {
    const item = transpileCanvasItem(DEFAULT_CANVAS_SHADER);

    expect(item.draw('attributes')).toBe(item.draw('attributes'));
  });

  it("samples TEXTURE with the item's sampler, as Godot's compiler pairs them", () => {
    const shader = 'shader_type canvas_item;\nvoid fragment() { COLOR = texture(TEXTURE, UV).bgra; }\n';

    const { material } = transpileCanvasItem(shader).draw('quad');

    expect(generatedMaterialProgram(material).fragment).toContain('texture(');
  });
});
