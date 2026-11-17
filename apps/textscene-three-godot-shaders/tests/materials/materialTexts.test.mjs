import { describe, expect, it } from 'vitest';
import { shaderTextOf } from '../../../../packages/textscene-core/src/shaders/material/baseMaterialShader.ts';
import { materialStateOf } from '../../../../packages/textscene-core/src/shaders/material/materialProperties.ts';
import { stencilPassOf } from '../../../../packages/textscene-core/src/shaders/material/stencilEffect.ts';
import { MATERIAL_CLASSES, parseCaseId, sha256 } from '../../../../scripts/godot-probes/materialTexts.mjs';
import { godotAnswers, liveMaterialTexts } from '../godotAnswers.mjs';

/** The state of the material a parsed case names, or of the next pass its stencil makes. */
function stateOf({ id, materialClass, settings, isNextPass }) {
  const state = materialStateOf(materialClass, settings);
  if (!isNextPass) return state;
  const pass = stencilPassOf(state);
  if (!pass) throw new Error(`expected an outline or x-ray stencil for next pass ${id}, found none`);
  return materialStateOf(pass.materialClass, pass.settings);
}

const answers = godotAnswers();
const cases = Object.entries(answers.materials.cases).map(([id, hash]) => ({ id, hash, ...parseCaseId(id) }));

/** The cache hands one string to every material of a key, so each distinct text is hashed once. */
const hashes = new Map();
const hashOf = (text) => hashes.get(text) ?? hashes.set(text, sha256(text)).get(text);

/** Each case of `materialClass` whose text is not Godot's. */
const mismatches = (materialClass) =>
  cases
    .filter((parsed) => parsed.materialClass === materialClass)
    .map((parsed) => ({ id: parsed.id, hash: parsed.hash, text: shaderTextOf(stateOf(parsed).key) }))
    .filter(({ hash, text }) => hashOf(text) !== hash);

/** Godot's text of the case, which only the live run holds. */
const godotText = ({ hash }) => (answers.live ? liveMaterialTexts()[hash] : `the text of hash ${hash}`);

describe("BaseMaterial3D's shader text", () => {
  it.each(MATERIAL_CLASSES)('equals Godot for every %s of the sweep', (materialClass) => {
    const wrong = mismatches(materialClass);
    const [first] = wrong;
    expect({ count: wrong.length, first: first && { id: first.id, text: first.text } }).toEqual({
      count: 0,
      first: first && { id: first.id, text: godotText(first) },
    });
  });
});
