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
import { KNOWN_DIFFERENCE_CASES, KNOWN_DIFFERENCES } from './knownDifferences.mjs';
import { generatePrograms } from './programs.mjs';
import { FIXED_SEED, RANDOM_PROGRAMS } from './randomSet.mjs';

/** The programs and the fixed cases, as Godot's record holds them. */
const RECORDED = [...RANDOM_PROGRAMS, ...KNOWN_DIFFERENCE_CASES];

const RECORD = JSON.parse(readFileSync(join(import.meta.dirname, 'godot-record.json'), 'utf8'));

describe("Godot's record of the random programs", () => {
  it('holds each program of the fixed set and each fixed case with its source and inputs now', () => {
    const stale = RECORDED.filter((program) => {
      const entry = RECORD.probes[program.name];
      const inputs = parameterBits(program).map((bits) => bits.map(hex));
      return entry?.source !== program.source || JSON.stringify(entry.inputs) !== JSON.stringify(inputs);
    });
    expect(stale.map((program) => program.name)).toEqual([]);
  });

  it('holds no program the set and the fixed cases have not', () => {
    const names = new Set(RECORDED.map((program) => program.name));
    expect(Object.keys(RECORD.probes).filter((name) => !names.has(name))).toEqual([]);
  });

  it('has values from Godot for every program, so Godot accepts each one', () => {
    expect(
      RANDOM_PROGRAMS.filter((program) => RECORD.probes[program.name]?.results === undefined).map(
        (program) => program.name
      )
    ).toEqual([]);
  });

  it('gives each known difference an owner, and a program only from the fixed set', () => {
    const names = new Set(RANDOM_PROGRAMS.map((program) => program.name));
    const unowned = Object.entries(KNOWN_DIFFERENCES).filter(
      ([, known]) => (known.program !== undefined && !names.has(known.program)) || !/^#\d+$/.test(known.owner)
    );
    expect(unowned.map(([name]) => name)).toEqual([]);
  });

  it('keeps the inputs of each fixed case bit for bit', () => {
    const changed = KNOWN_DIFFERENCE_CASES.filter(
      (known) =>
        JSON.stringify(parameterBits(known).map((bits) => bits.map(hex).join(' '))) !==
        JSON.stringify(KNOWN_DIFFERENCES[known.known].inputs)
    );
    expect(changed.map((known) => known.name)).toEqual([]);
  });
});

describe('the fixed known-difference cases', () => {
  it('stay whatever the size of the generated set', () => {
    const small = generatePrograms({ seed: FIXED_SEED, count: 0 });
    const large = generatePrograms({ seed: FIXED_SEED, count: 400 });
    expect(small.length).not.toBe(large.length);
    // The cases are built from the list alone, so a set of any size runs every one of them.
    for (const programs of [small, large]) {
      const run = [...programs, ...KNOWN_DIFFERENCE_CASES].map((program) => program.name);
      for (const name of Object.keys(KNOWN_DIFFERENCES)) expect(run).toContain(`known-${name}`);
    }
  });

  it('are named apart from every generated program, so no program of a new set replaces one', () => {
    const generated = new Set(
      generatePrograms({ seed: FIXED_SEED, count: 400 }).map((program) => program.name)
    );
    expect(KNOWN_DIFFERENCE_CASES.filter((known) => generated.has(known.name))).toEqual([]);
  });
});
