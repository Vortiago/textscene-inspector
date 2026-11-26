import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canvasItemMaterialShader } from '../../../../packages/textscene-core/src/shaders/canvas/canvasItemMaterialShader.ts';
import { CANVAS_ITEM_MATERIALS_FILE } from '../../../../scripts/godot-probes/canvasItemMaterials.mjs';
import { verdictOfText } from '../../../../scripts/godot-probes/shaderVerdicts.mjs';
import { judge, parserVerdict } from '../verdicts/judge.mjs';

const record = JSON.parse(readFileSync(CANVAS_ITEM_MATERIALS_FILE, 'utf8'));

/** A case's properties with the constructor's defaults (`canvas_item_material.cpp:282`). */
const settingsOf = (properties) => ({
  blendMode: properties.blend_mode ?? 0,
  lightMode: properties.light_mode ?? 0,
  particlesAnimation: properties.particles_animation ?? false,
  particlesAnimHFrames: properties.particles_anim_h_frames ?? 1,
  particlesAnimVFrames: properties.particles_anim_v_frames ?? 1,
  particlesAnimLoop: properties.particles_anim_loop ?? false,
});

const generated = (each) => canvasItemMaterialShader(settingsOf(each.properties));

describe("CanvasItemMaterial's shader text", () => {
  it('comes from Godot 4.6.3', () => {
    expect(record.godot).toMatch(/^4\.6\.3-stable/);
  });

  it.each(record.texts.map((each) => [JSON.stringify(each.properties), each]))(
    'equals Godot for %s',
    (_properties, each) => {
      expect(generated(each).code).toBe(each.code);
    }
  );

  it.each(record.texts.map((each) => [JSON.stringify(each.properties), each]))(
    'parses %s as Godot compiles it',
    (_properties, each) => {
      const { state, detail } = judge(verdictOfText(each.verdict), parserVerdict(each.code));
      expect({ state, detail }).toEqual({
        state: expect.stringMatching(/^(transpiled|refused as Godot refuses)$/),
        detail,
      });
    }
  );

  it.each(record.parameters.map((each) => [JSON.stringify(each.properties), each]))(
    'uploads the parameters Godot uploads for %s',
    (_properties, each) => {
      expect(generated(each).parameters).toEqual(each.values);
    }
  );
});
