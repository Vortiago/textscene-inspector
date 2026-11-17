import { decompress as brotliDecompress } from 'brotli/decompress';
import { decompress as zstdDecompress } from 'fzstd';
import { describe, expect, it } from 'vitest';
import { runExpression } from '../../../../packages/textscene-core/src/godot/expression/execute.ts';
import { decodersOf } from '../../../../packages/textscene-core/src/shaders/preprocessor/decoders.ts';
import { GodotCrash } from '../../../../packages/textscene-core/src/godot/variant/cInteger.ts';
import { utilityHost } from '../../../../packages/textscene-core/src/godot/variant/utility/utilityHost.ts';
import { PROJECT_FILES } from '../../../../scripts/godot-variant/godotExpressions.mjs';
import { godotAnswers } from '../godotAnswers.mjs';
import { dumpVariant } from './dump.mjs';
import { EXPRESSIONS } from './expressionSet.mjs';
import { LIBRARY_DIFFERENCES } from './libraryDifferences.mjs';
import { allowedRefusal, isRunDependent, REFUSED_CASES, RUN_DEPENDENT_ANSWER } from './refusedCases.mjs';

/** The decoders an app lends for Zstandard and Brotli, so every case has Godot's answer. */
const DECODERS = decodersOf({ zstd: zstdDecompress, brotli: brotliDecompress });
const RECORD = godotAnswers().expressions;
const IS_LIVE = godotAnswers().live;

/** The port's answer in the shape Godot's run records, or the class of what it refuses with. */
function portAnswer(text) {
  try {
    const result = runExpression(
      text,
      utilityHost((path) => PROJECT_FILES.includes(path), DECODERS)
    );
    if ('executeError' in result)
      return { verdict: 'execute', text: result.executeError, left: dumpVariant(result.value) };
    if ('parseError' in result) return { verdict: 'parse', text: result.parseError };
    return { verdict: 'value', text: dumpVariant(result.value) };
  } catch (error) {
    if (error instanceof GodotCrash) return { verdict: 'crash', text: '' };
    return { refusal: error.constructor.name };
  }
}

const ANSWERS = new Map(EXPRESSIONS.map((test) => [test.id, portAnswer(test.text)]));
const ANSWERED = EXPRESSIONS.filter((test) => RECORD.cases[test.id] !== undefined);
describe('the Expression port against Godot', () => {
  it.runIf(IS_LIVE)('has an answer from Godot for every case', () => {
    expect(EXPRESSIONS.filter((test) => RECORD.cases[test.id] === undefined).map((test) => test.id)).toEqual(
      []
    );
  });

  it('holds no case that is not a case now', () => {
    const ids = new Set(EXPRESSIONS.map((test) => test.id));
    expect(Object.keys(RECORD.cases).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('records no answer of Godot that depends on the run', () => {
    const recorded = ANSWERED.filter(isRunDependent).filter(
      (test) => RECORD.cases[test.id].verdict !== RUN_DEPENDENT_ANSWER.verdict
    );
    expect(recorded.map((test) => test.id)).toEqual([]);
  });

  it('answers each case as Godot does', () => {
    const mismatches = ANSWERED.filter((test) => ANSWERS.get(test.id).refusal === undefined)
      .filter((test) => !isRunDependent(test))
      .filter((test) => LIBRARY_DIFFERENCES[test.id] === undefined)
      .filter((test) => {
        const [ours, godot] = [ANSWERS.get(test.id), RECORD.cases[test.id]];
        return ours.verdict !== godot.verdict || ours.text !== godot.text || ours.left !== godot.left;
      })
      .map(
        (test) =>
          `${test.id}: Godot ${JSON.stringify(RECORD.cases[test.id])}, port ${JSON.stringify(ANSWERS.get(test.id))}`
      );
    expect(mismatches).toEqual([]);
  });

  it('differs from Godot on each listed library case exactly as listed', () => {
    const changed = Object.entries(LIBRARY_DIFFERENCES)
      .filter(([id]) => RECORD.cases[id] !== undefined)
      .filter(([id, { godot, port }]) => RECORD.cases[id].text !== godot || ANSWERS.get(id)?.text !== port)
      .map(([id]) => id);
    expect(changed).toEqual([]);
  });

  it('refuses only the listed cases, each with its listed refusal', () => {
    const refused = EXPRESSIONS.filter((test) => ANSWERS.get(test.id).refusal !== undefined).map((test) => [
      test.id,
      ANSWERS.get(test.id).refusal,
      allowedRefusal(test)?.refusal,
    ]);
    expect(refused.filter(([, refusal, allowed]) => refusal !== allowed)).toEqual([]);
  });

  it('lists no refusal the port has outgrown', () => {
    const outgrown = Object.keys(REFUSED_CASES).filter((id) => ANSWERS.get(id)?.refusal === undefined);
    expect(outgrown).toEqual([]);
  });

  it('comes from Godot 4.6.3', () => {
    expect(RECORD.godot).toMatch(/^4\.6\.3-stable/);
  });
});
