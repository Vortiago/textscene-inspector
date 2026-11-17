import { describe, expect, it } from 'vitest';
import { shaderTextOf } from '../../../../packages/textscene-core/src/shaders/material/baseMaterialShader.ts';
import { materialStateOf } from '../../../../packages/textscene-core/src/shaders/material/materialProperties.ts';
import { stencilPassOf } from '../../../../packages/textscene-core/src/shaders/material/stencilEffect.ts';
import { MATERIAL_CLASSES, parseCaseId, sha256 } from '../../../../scripts/godot-probes/materialTexts.mjs';
import { verdictOfText } from '../../../../scripts/godot-probes/shaderVerdicts.mjs';
import { godotAnswers, liveMaterialTexts } from '../godotAnswers.mjs';
import { judge, parserVerdict } from '../verdicts/judge.mjs';

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

/** Each case's generated text, with Godot's hash. */
const generated = cases.map((parsed) => ({ ...parsed, text: shaderTextOf(stateOf(parsed).key) }));

/** Each case of `materialClass` whose text is not Godot's. */
const mismatches = (materialClass) =>
  generated.filter((made) => made.materialClass === materialClass && hashOf(made.text) !== made.hash);

/** Each generated text that equals Godot's, by its hash. */
const textsByHash = new Map(
  generated.filter((made) => hashOf(made.text) === made.hash).map((made) => [made.hash, made.text])
);

/** A parse of each of the 9,493 distinct texts takes about 6 s alone, more beside the other test files. */
const PARSE_ALL_TIMEOUT_MS = 60_000;

/** The states of a parse that agrees with Godot's compiler. */
const AGREES = ['transpiled', 'refused as Godot refuses'];

/** Godot's text of the case, which only a live run of the whole sweep holds. */
const godotText = ({ hash }) =>
  answers.materials.live ? liveMaterialTexts()[hash] : `the text of hash ${hash}`;

describe("BaseMaterial3D's shader text", () => {
  it.each(MATERIAL_CLASSES)('equals Godot for every %s of the sweep', (materialClass) => {
    const wrong = mismatches(materialClass);
    const [first] = wrong;
    expect({ count: wrong.length, first: first && { id: first.id, text: first.text } }).toEqual({
      count: 0,
      first: first && { id: first.id, text: godotText(first) },
    });
  });

  it(
    "parses each distinct text Godot accepts, and refuses each other with Godot's message and line",
    () => {
      const disagreements = Object.entries(answers.materials.verdicts)
        .filter(([hash]) => textsByHash.has(hash))
        .map(([hash, verdict]) => ({
          hash,
          outcome: judge(verdictOfText(verdict), parserVerdict(textsByHash.get(hash))),
        }))
        .filter(({ outcome }) => !AGREES.includes(outcome.state))
        .map(({ hash, outcome }) => `${hash}: ${outcome.detail}`);
      expect(disagreements).toEqual([]);
    },
    PARSE_ALL_TIMEOUT_MS
  );
});
