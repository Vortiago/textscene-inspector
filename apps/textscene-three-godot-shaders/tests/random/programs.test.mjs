import { describe, expect, it } from 'vitest';
import { probeSignature } from '../../../../scripts/godot-probes/probeShader.mjs';
import { transpilerVerdict } from '../verdicts/judge.mjs';
import { generatePrograms, TRANSLATED_ROWS } from './programs.mjs';

const SET = generatePrograms({ seed: 7, count: 40 });

describe('the random program generator', () => {
  it('gives the same programs for the same seed', () => {
    const again = generatePrograms({ seed: 7, count: 40 });
    expect(again.map((program) => [program.source, program.inputs])).toEqual(
      SET.map((program) => [program.source, program.inputs])
    );
  });

  it('gives other programs for another seed', () => {
    const other = generatePrograms({ seed: 8, count: 40 }).map((program) => program.source);
    expect(other).not.toEqual(SET.map((program) => program.source));
  });

  it('uses every translated row in a set', () => {
    const used = new Set(SET.flatMap((program) => program.rows));
    expect(TRANSLATED_ROWS.map((row) => row.id).filter((id) => !used.has(id))).toEqual([]);
  });

  it('uses only translated rows', () => {
    const translated = new Set(TRANSLATED_ROWS.map((row) => row.id));
    expect(SET.flatMap((program) => program.rows).filter((id) => !translated.has(id))).toEqual([]);
  });

  it('writes programs the transpiler reads', () => {
    const refused = SET.map((program) => ({ program, verdict: transpilerVerdict(program.source) }))
      .filter(({ verdict }) => !verdict.accepted)
      .map(({ program, verdict }) => `${program.name}: ${verdict.message ?? verdict.crashed}`);
    expect(refused).toEqual([]);
  });

  it('writes programs the probe harness runs', () => {
    for (const program of SET) expect(() => probeSignature(program.source)).not.toThrow();
  });
});
