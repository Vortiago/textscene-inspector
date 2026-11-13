/**
 * The static half of the coverage test: each transpiled row is a row of Godot's instruction
 * table, each probe has a current record of Godot's answers, and the list of open rows only
 * shrinks. The real-GL half, that each probe's transpilation equals the record, runs in
 * `pnpm test:shaders:gpu`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { hex, recordEntry } from '../../../../scripts/godot-probes/record.mjs';
import { parameterBits, SENTINEL_BITS } from '../../../../scripts/godot-probes/probeShader.mjs';
import { PROBES } from './probes.mjs';

const RECORD = JSON.parse(readFileSync(join(import.meta.dirname, 'godot-record.json'), 'utf8'));

/**
 * The most rows that may stay open. A slice that transpiles rows lowers it, and a change that
 * opens a transpiled row again fails here.
 */
const OPEN_ROWS_AT_MOST = 1821;

const transpiledRows = new Set(PROBES.flatMap((probe) => probe.rows));

describe('the instruction table coverage', () => {
  it('names only rows of the instruction table', () => {
    const ids = new Set(INSTRUCTION_TABLE.map((row) => row.id));
    expect([...transpiledRows].filter((row) => !ids.has(row))).toEqual([]);
  });

  it('keeps the open rows at or under their ceiling', () => {
    expect(INSTRUCTION_TABLE.length - transpiledRows.size).toBeLessThanOrEqual(OPEN_ROWS_AT_MOST);
  });

  it('has a record from Godot for every probe', () => {
    expect(
      PROBES.filter((probe) => RECORD.probes[probe.name] === undefined).map((probe) => probe.name)
    ).toEqual([]);
  });

  it('records the source and inputs each probe has now', () => {
    const stale = PROBES.filter((probe) => {
      const entry = RECORD.probes[probe.name];
      const inputs = parameterBits(probe).map((bits) => bits.map(hex));
      return entry.source !== probe.source || JSON.stringify(entry.inputs) !== JSON.stringify(inputs);
    });
    expect(stale.map((probe) => probe.name)).toEqual([]);
  });

  it('has Godot values, not only a rejection, for every transpiled row', () => {
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

  it('records a rejection when the sentinel is missing', () => {
    expect(recordEntry(probe, [0, 0, 0, 0, 0, 0]).rejected).toMatch(/rejects/);
  });
});
