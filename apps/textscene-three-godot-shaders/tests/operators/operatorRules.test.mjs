/**
 * The operator rules in full: one tiny shader for each operator and each tuple of operand types.
 * Godot's recorded verdict must agree with the instruction table, whose operator rows the
 * interpreter of `_validate_operator` reads, and the transpiler's front end must not disagree.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verdictOfText } from '../../../../scripts/godot-probes/shaderVerdicts.mjs';
import { judge, transpilerVerdict } from '../verdicts/judge.mjs';
import { OPERATOR_CASES } from './operatorCases.mjs';

const RECORD = JSON.parse(readFileSync(join(import.meta.dirname, 'godot-verdicts.json'), 'utf8'));

const godotVerdict = (id) => verdictOfText(RECORD.cases[id]);

describe('the operator rules against Godot', () => {
  it('has a verdict from Godot for every case', () => {
    expect(
      OPERATOR_CASES.filter((test) => RECORD.cases[test.id] === undefined).map((test) => test.id)
    ).toEqual([]);
  });

  it('records no case that is not a case now', () => {
    const ids = new Set(OPERATOR_CASES.map((test) => test.id));
    expect(Object.keys(RECORD.cases).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('has a row in the instruction table exactly where Godot accepts the case', () => {
    const disagreements = OPERATOR_CASES.filter(
      (test) => godotVerdict(test.id).accepted !== (test.row !== undefined)
    ).map((test) => `${test.id}: Godot ${RECORD.cases[test.id]}, table ${test.row ? 'has' : 'has no'} row`);
    expect(disagreements).toEqual([]);
  });

  it("gives Godot's verdict in the transpiler's front end, or names the owner of the open row", () => {
    const mismatches = OPERATOR_CASES.map((test) => ({
      id: test.id,
      outcome: judge(godotVerdict(test.id), transpilerVerdict(test.transpilerText)),
    }))
      .filter(({ outcome }) => outcome.state === 'mismatch')
      .map(({ id, outcome }) => `${id}: ${outcome.detail}`);
    expect(mismatches).toEqual([]);
  });

  it('comes from Godot 4.6.3', () => {
    expect(RECORD.godot).toMatch(/^4\.6\.3-stable/);
  });
});
