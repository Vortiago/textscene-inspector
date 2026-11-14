/**
 * The static half of the random program test: Godot's answers hold every program of the fixed
 * set as it is generated now, and Godot accepts each one, as a generator correct by type must
 * write. The real-GL half runs in `pnpm test:shaders:gpu`.
 */

import { describe, expect, it } from 'vitest';
import { hex } from '../../../../scripts/godot-probes/record.mjs';
import { parameterBits } from '../../../../scripts/godot-probes/probeShader.mjs';
import { godotAnswers } from '../godotAnswers.mjs';
import { KNOWN_DIFFERENCE_CASES, KNOWN_DIFFERENCES, recordedRandomProbes } from './knownDifferences.mjs';
import { generatePrograms } from './programs.mjs';
import { FIXED_SEED, RANDOM_PROGRAMS } from './randomSet.mjs';

/** The programs and the fixed cases, as Godot's record holds them. */
const RECORDED = recordedRandomProbes(RANDOM_PROGRAMS);

const ANSWERS = godotAnswers();
const RECORD = ANSWERS.random;

describe("Godot's answers to the random programs", () => {
  it.runIf(ANSWERS.live)('hold each program of the fixed set and each fixed case', () => {
    expect(
      RECORDED.filter((program) => RECORD.probes[program.name] === undefined).map((program) => program.name)
    ).toEqual([]);
  });

  it('hold the source and inputs each program and fixed case has now', () => {
    const stale = RECORDED.filter((program) => {
      const entry = RECORD.probes[program.name];
      if (entry === undefined) return false;
      const inputs = parameterBits(program).map((bits) => bits.map(hex));
      return entry.source !== program.source || JSON.stringify(entry.inputs) !== JSON.stringify(inputs);
    });
    expect(stale.map((program) => program.name)).toEqual([]);
  });

  it('hold no program the set and the fixed cases have not', () => {
    const names = new Set(RECORDED.map((program) => program.name));
    expect(Object.keys(RECORD.probes).filter((name) => !names.has(name))).toEqual([]);
  });

  it.runIf(ANSWERS.live)('have values from Godot for every program, so Godot accepts each one', () => {
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
      (knownCase) =>
        JSON.stringify(parameterBits(knownCase).map((bits) => bits.map(hex).join(' '))) !==
        JSON.stringify(KNOWN_DIFFERENCES[knownCase.difference].inputs)
    );
    expect(changed.map((knownCase) => knownCase.name)).toEqual([]);
  });
});

describe('the fixed known-difference cases', () => {
  it('stay whatever the size of the generated set', () => {
    const small = generatePrograms({ seed: FIXED_SEED, count: 0 });
    const large = generatePrograms({ seed: FIXED_SEED, count: 400 });
    expect(small.length).not.toBe(large.length);
    // `pnpm godot:probes` records the probes of `recordedRandomProbes`, whatever the set holds.
    const caseNames = KNOWN_DIFFERENCE_CASES.map((knownCase) => knownCase.name);
    for (const programs of [small, large]) {
      const recorded = recordedRandomProbes(programs).map((program) => program.name);
      expect(caseNames.filter((name) => !recorded.includes(name))).toEqual([]);
    }
  });

  it('are named apart from every generated program, so no program of a new set replaces one', () => {
    const generated = new Set(
      generatePrograms({ seed: FIXED_SEED, count: 400 }).map((program) => program.name)
    );
    expect(KNOWN_DIFFERENCE_CASES.filter((knownCase) => generated.has(knownCase.name))).toEqual([]);
  });
});
