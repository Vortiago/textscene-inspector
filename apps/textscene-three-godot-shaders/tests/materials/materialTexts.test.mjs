import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { shaderTextOf } from '../../../../packages/textscene-core/src/shaders/material/baseMaterialShader.ts';
import { materialStateOf } from '../../../../packages/textscene-core/src/shaders/material/materialProperties.ts';
import { stencilPassOf } from '../../../../packages/textscene-core/src/shaders/material/stencilEffect.ts';
import { NEXT_PASS } from '../../../../scripts/godot-probes/materialTexts.mjs';
import { godotAnswers, liveMaterialTexts } from '../godotAnswers.mjs';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** The material a case id names, `Class|property=value|...`, or the next pass it makes, `...|next_pass`. */
function materialOf(id) {
  const [materialClass, ...parts] = id.split('|');
  const isNextPass = parts.at(-1) === NEXT_PASS;
  const settings = (isNextPass ? parts.slice(0, -1) : parts).map((setting) => {
    const [name, value] = setting.split('=');
    return [name, value === 'true' ? true : Number(value)];
  });
  const state = materialStateOf(materialClass, Object.fromEntries(settings));
  return isNextPass ? materialStateOf('StandardMaterial3D', stencilPassOf(state).settings) : state;
}

const answers = godotAnswers();
const cases = Object.entries(answers.materials.cases);
const texts = answers.live ? liveMaterialTexts() : undefined;

/** Each case whose text is not Godot's, with Godot's text when the live run has it. */
function mismatches(materialClass) {
  return cases
    .filter(([id]) => id.split('|')[0] === materialClass)
    .flatMap(([id, hash]) => {
      const text = shaderTextOf(materialOf(id).key);
      if (sha256(text) === hash) return [];
      return [{ id, text, godot: texts?.[hash] }];
    });
}

describe("BaseMaterial3D's shader text", () => {
  it.each(['StandardMaterial3D', 'ORMMaterial3D'])(
    'equals Godot for every %s of the sweep',
    (materialClass) => {
      const wrong = mismatches(materialClass);
      const [first] = wrong;
      expect({ count: wrong.length, first: first && { id: first.id, text: first.text } }).toEqual({
        count: 0,
        first: first && {
          id: first.id,
          text: first.godot ?? `the text of hash ${answers.materials.cases[first.id]}`,
        },
      });
    }
  );
});
