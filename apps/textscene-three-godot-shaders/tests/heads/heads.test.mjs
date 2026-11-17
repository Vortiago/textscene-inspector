import { describe, expect, it } from 'vitest';
import { verdictOfText } from '../../../../scripts/godot-probes/shaderVerdicts.mjs';
import { godotAnswers } from '../godotAnswers.mjs';
import { judge, transpilerVerdict } from '../verdicts/judge.mjs';
import { HEAD_CASES } from './headCases.mjs';

const ANSWERS = godotAnswers();
const RECORD = ANSWERS.heads;

/** The cases Godot answered: every case on a live run, the smoke subset outside the CI image. */
const ANSWERED = HEAD_CASES.filter((test) => RECORD.cases[test.id] !== undefined);

const outcomeOf = (test) => judge(verdictOfText(RECORD.cases[test.id]), transpilerVerdict(test.text));

describe('the shader head and the processor functions against Godot', () => {
  it.runIf(ANSWERS.live)('has a verdict from Godot for every case', () => {
    expect(HEAD_CASES.filter((test) => RECORD.cases[test.id] === undefined).map((test) => test.id)).toEqual(
      []
    );
  });

  it('holds no case that is not a case now', () => {
    const ids = new Set(HEAD_CASES.map((test) => test.id));
    expect(Object.keys(RECORD.cases).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("gives Godot's verdict, message and line included, or names the owner of the open row", () => {
    const mismatches = ANSWERED.map((test) => ({ id: test.id, outcome: outcomeOf(test) }))
      .filter(({ outcome }) => outcome.state === 'mismatch')
      .map(({ id, outcome }) => `${id}: ${outcome.detail}`);
    expect(mismatches).toEqual([]);
  });

  it('transpiles every case that names the rows it proves', () => {
    const open = ANSWERED.filter((test) => test.rows.length > 0)
      .map((test) => ({ id: test.id, outcome: outcomeOf(test) }))
      .filter(({ outcome }) => outcome.state !== 'transpiled')
      .map(({ id, outcome }) => `${id}: ${outcome.state}, ${outcome.detail ?? ''}`);
    expect(open).toEqual([]);
  });
});
