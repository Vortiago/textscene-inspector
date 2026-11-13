/**
 * The static half of the random program test: Godot's record holds every program of the fixed
 * set as it is generated now, and Godot accepts each one, as a generator correct by type must
 * write. The real-GL half runs in `pnpm test:shaders:gpu`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hex } from '../../../../scripts/godot-probes/record.mjs';
import { parameterBits } from '../../../../scripts/godot-probes/probeShader.mjs';
import { KNOWN_DIFFERENCES } from './knownDifferences.mjs';
import { RANDOM_PROGRAMS } from './randomSet.mjs';

const RECORD = JSON.parse(readFileSync(join(import.meta.dirname, 'godot-record.json'), 'utf8'));

describe("Godot's record of the random programs", () => {
  it('holds each program of the fixed set with its source and inputs now', () => {
    const stale = RANDOM_PROGRAMS.filter((program) => {
      const entry = RECORD.probes[program.name];
      const inputs = parameterBits(program).map((bits) => bits.map(hex));
      return entry?.source !== program.source || JSON.stringify(entry.inputs) !== JSON.stringify(inputs);
    });
    expect(stale.map((program) => program.name)).toEqual([]);
  });

  it('holds no program the set has not', () => {
    const names = new Set(RANDOM_PROGRAMS.map((program) => program.name));
    expect(Object.keys(RECORD.probes).filter((name) => !names.has(name))).toEqual([]);
  });

  it('has values from Godot for every program, so Godot accepts each one', () => {
    expect(
      RANDOM_PROGRAMS.filter((program) => RECORD.probes[program.name]?.results === undefined).map(
        (program) => program.name
      )
    ).toEqual([]);
  });

  it('lists as known differences only programs of the fixed set, each with an owner', () => {
    const names = new Set(RANDOM_PROGRAMS.map((program) => program.name));
    const unowned = Object.entries(KNOWN_DIFFERENCES).filter(
      ([name, known]) => !names.has(name) || !/^#\d+$/.test(known.owner)
    );
    expect(unowned.map(([name]) => name)).toEqual([]);
  });
});
