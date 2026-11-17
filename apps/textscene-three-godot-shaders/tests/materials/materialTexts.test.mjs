import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { baseMaterialShader } from '../../../../packages/textscene-core/src/shaders/material/baseMaterialShader.ts';
import { godotAnswers, liveMaterialTexts } from '../godotAnswers.mjs';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** The class and settings a case id names: `Class|property=value|property=value`. */
function materialOf(id) {
  const [materialClass, ...settings] = id.split('|');
  const values = settings.map((setting) => {
    const [name, value] = setting.split('=');
    return [name, value === 'true' ? true : Number(value)];
  });
  return { materialClass, settings: Object.fromEntries(values) };
}

const answers = godotAnswers();
const cases = Object.entries(answers.materials.cases);
const texts = answers.live ? liveMaterialTexts() : undefined;

/** Each case whose text is not Godot's, with Godot's text when the live run has it. */
function mismatches(materialClass) {
  return cases
    .filter(([id]) => id.split('|')[0] === materialClass)
    .flatMap(([id, hash]) => {
      const material = materialOf(id);
      const text = baseMaterialShader(material.materialClass, material.settings);
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
