/**
 * Enumerating what the registry holds belongs to `registryPopulation.ts` alone: a
 * population assembled by hand reaches the roots only. Point lookups on a named type
 * (`findValidator`, `getOwnKeys`, `baseChainOf`) are unrestricted. The enumerator is
 * `@internal` by convention only, and a recomposition through `registeredTypes` compiles.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { atLeast, srcLabel, srcRoot, walk } from './testing/ruleNameScrape.js';

/** The module the discipline belongs to, and the class that defines it. */
const OWNERS = ['linter/registryPopulation.ts', 'linter/ValidatorRegistry.ts'];

/**
 * This file. It has to spell every identifier it bans, so scanning itself
 * reports the scanner. Excluded by path rather than by an `ALLOWED` entry,
 * because it is not a subject that earned an exemption.
 */
const SELF = 'linter/populationDiscipline.guard.test.ts';

/**
 * Files allowed to name a population enumerator beside `declarationFor`, each with
 * the reason. Stale-checked below: an unneeded entry fails, because it pre-forgives
 * whatever is written under that path next.
 */
const ALLOWED: Record<string, string> = {
  'linter/registryPopulation.test.ts': 'the module’s own tests, which drive both halves',
  'linter/boundGrounding.test.ts':
    'asserts a removal is absent from the declaring population, then point-probes that removal’s own grounding',
  'linter/validatorAccepts.test.ts':
    'compares the declaring type list against the full validator population, then reads one named slot’s prose',
};

/**
 * Every `.ts`/`.tsx` in the package, tests included, unlike `allSourceFiles`: a
 * registry-wide sweep is a test, so a scan that skipped tests would miss its subject.
 */
const everyFile = (): string[] =>
  atLeast(
    walk(srcRoot, (name) => /\.tsx?$/.test(name)),
    1500,
    'populationDiscipline scan'
  );

/**
 * The offence, spelled once so no second spelling can diverge: a file that enumerates
 * a population and reads a declaration off it has rebuilt the roots-only walk.
 */
const namesBothHalves = ({ body }: { body: string }): boolean =>
  body.includes('registeredTypes') && body.includes('declarationFor');

/** Every identifier any arm below asks about. */
const TELLS = ['typesWithRegistrations', 'getTypesWithRemovals', 'registeredTypes', 'declarationFor', 'getOwnKeys', 'findValidator'];

/**
 * Raw text first, comments stripped only for a file that can possibly hit. The
 * prefilter is sound: `stripComments` blanks characters in place and never inserts
 * text, so a raw miss can never become a stripped hit. Stripping every file costs time
 * and memory for a few `includes`.
 */
function scanned(): { at: string; body: string }[] {
  const out: { at: string; body: string }[] = [];
  for (const file of everyFile()) {
    const raw = readFileSync(file, 'utf8');
    if (!TELLS.some((tell) => raw.includes(tell))) continue;
    out.push({ at: srcLabel(file), body: stripComments(raw) });
  }
  return out;
}

describe('enumerating the registry belongs to one module', () => {
  const files = scanned().filter(({ at }) => at !== SELF);

  it('scans a population that cannot quietly empty', () => {
    // `everyFile` floors the walk. This floors what survives the prefilter, so a
    // rename of every tell, or a move out of the scrape, fails loudly.
    expect(files.length).toBeGreaterThan(100);
    for (const owner of OWNERS) {
      expect(files.some(({ at }) => at === owner), `${owner} is outside the scan`).toBe(true);
    }
  });

  it.each(['typesWithRegistrations', 'getTypesWithRemovals'])(
    'keeps the %s enumerator inside the two files that define the seam',
    (enumerator) => {
      // Both doors: a discipline enforced on one of two equivalent enumerators
      // is one the next author walks around without noticing.
      const reached = files
        .filter(({ body }) => body.includes(enumerator))
        .map(({ at }) => at)
        .sort();
      expect(reached).toEqual([...OWNERS].sort());
    }
  );

  it('lets nobody else recompose a population and then read declarations off it', () => {
    // `registeredTypes(...) x getOwnKeys x declarationFor` is the one spelling
    // that still type-checks all the way to a tag. Naming both halves in one
    // file is the tell.
    const offenders = files
      .filter(({ at }) => !OWNERS.includes(at) && !(at in ALLOWED))
      .filter(namesBothHalves)
      .map(({ at }) => at);
    expect(
      offenders,
      'ask `everyValidator` for the validator population; it cannot stop at the roots'
    ).toEqual([]);
  });

  it('holds no exemption that exempts nothing', () => {
    const stale = Object.keys(ALLOWED).filter((at) => {
      const file = files.find((f) => f.at === at);
      return !file || !namesBothHalves(file);
    });
    expect(stale).toEqual([]);
  });

  /**
   * Widening a lookup into a declaration, by assertion or annotated assignment. A
   * lookup passed straight into a `PropertyValidator` slot stays open: its tags are
   * all optional, so `ValidatorFn` is assignable, and only a branded type, which
   * costs many errors across the tree, would close that.
   */
  const LAUNDERS = [
    /\bas\s+PropertyValidator\b/,
    /:\s*PropertyValidator(?:\s*\|\s*null)?\s*=\s*(?:\w+\.)?findValidator\(/,
  ];

  it('never widens a lookup back into a declaration', () => {
    const offenders = files
      .filter(({ at }) => !OWNERS.includes(at))
      .filter(({ body }) => LAUNDERS.some((re) => re.test(body)))
      .map(({ at }) => at);
    expect(offenders, 'ask `declarationFor`, which says it is introspecting').toEqual([]);
  });

  it('bites on both spellings, so the empty result above is not a dead pattern', () => {
    // The positive control: every other arm here is an equality or has a floor,
    // and a pattern that matches nothing passes whether or not the offence exists.
    const cast = 'const v = findValidator(t, k) as PropertyValidator;';
    const annotated = 'const v: PropertyValidator | null = findValidator(t, k);';
    for (const sample of [cast, annotated]) {
      expect(LAUNDERS.some((re) => re.test(sample)), sample).toBe(true);
    }
    expect(LAUNDERS.some((re) => re.test('const v = findValidator(t, k);'))).toBe(false);
    // A new validator whose body calls a lookup is not a widening of one:
    // `boneconstraint3d/linterParser.ts` delegates exactly like this.
    const delegate =
      'const d: PropertyValidator = (key, value, line) => ' +
      'validatorRegistry.findValidator(T, key)?.(key, value, line) ?? null;';
    expect(LAUNDERS.some((re) => re.test(delegate))).toBe(false);
  });

  it('leaves the scaffolded slice shape alone', () => {
    // `getOwnKeys` beside `declarationFor` is the single-type shape the scaffolder
    // emits in slice tests, so banning it would fire on the population it protects.
    const sliceShape = files.filter(
      ({ body }) => body.includes('getOwnKeys') && body.includes('declarationFor')
    );
    expect(sliceShape.length).toBeGreaterThan(5);
  });
});
