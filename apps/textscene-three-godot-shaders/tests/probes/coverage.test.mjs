import { describe, expect, it } from 'vitest';
import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { isStaleEntry, recordEntry } from '../../../../scripts/godot-probes/record.mjs';
import { SENTINEL_BITS } from '../../../../scripts/godot-probes/probeShader.mjs';
import { godotAnswers } from '../godotAnswers.mjs';
import { PROBES } from './probes.mjs';

const ANSWERS = godotAnswers();
const RECORD = ANSWERS.probes;

/** A slice that transpiles rows lowers this, and a row opened again fails here. */
const OPEN_ROWS_AT_MOST = 713;

const transpiledRows = new Set(PROBES.flatMap((probe) => probe.rows));

describe('the instruction table coverage', () => {
  it('names each probe once, as the record keys its answers by name', () => {
    const names = PROBES.map((probe) => probe.name);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it('names only rows of the instruction table', () => {
    const ids = new Set(INSTRUCTION_TABLE.map((row) => row.id));
    expect([...transpiledRows].filter((row) => !ids.has(row))).toEqual([]);
  });

  it('keeps the open rows at or under their ceiling', () => {
    expect(INSTRUCTION_TABLE.length - transpiledRows.size).toBeLessThanOrEqual(OPEN_ROWS_AT_MOST);
  });

  it.runIf(ANSWERS.live)('has an answer from Godot for every probe', () => {
    expect(
      PROBES.filter((probe) => RECORD.probes[probe.name] === undefined).map((probe) => probe.name)
    ).toEqual([]);
  });

  it('holds the source and inputs each probe has now', () => {
    const stale = PROBES.filter((probe) => {
      const entry = RECORD.probes[probe.name];
      return entry !== undefined && isStaleEntry(entry, probe);
    });
    expect(stale.map((probe) => probe.name)).toEqual([]);
  });

  it.runIf(ANSWERS.live)('has Godot values, not only a rejection, for every transpiled row', () => {
    const withValues = new Set(
      PROBES.filter((probe) => RECORD.probes[probe.name].results !== undefined).flatMap((probe) => probe.rows)
    );
    expect([...transpiledRows].filter((row) => !withValues.has(row))).toEqual([]);
  });

  it('comes from Godot 4.6.3', () => {
    expect(RECORD.godot).toMatch(/^4\.6\.3-stable/);
  });
});

describe('recordEntry', () => {
  const probe = { name: 'p', rows: [], source: 'float probe(float a) { return a; }', inputs: [[1], [2]] };

  it('reads one lane per row and drops the second viewport row', () => {
    const entry = recordEntry(probe, [0x3f800000, 0x40000000, SENTINEL_BITS, 0, 0, 0]);
    expect(entry.results).toEqual([['3f800000'], ['40000000']]);
  });

  it("records Godot's reason when the sentinel is missing", () => {
    const reason = { stage: 'GLSL', message: "'inf' : undeclared identifier", line: 322 };
    expect(recordEntry(probe, [0, 0, 0, 0, 0, 0], reason).rejected).toEqual(reason);
  });
});
