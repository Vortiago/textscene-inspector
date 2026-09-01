/**
 * Enumerating what the registry holds belongs to ONE module.
 *
 * Point lookups on a NAMED type — `findValidator`, `getOwnKeys`, `baseChainOf`
 * — stay the registry's own interface and are unrestricted. Asking what the
 * registry holds WITHOUT naming a type is `registryPopulation.ts`'s alone,
 * because assembling that population by hand is what reached ROOTS only and
 * missed 415 validators, five separate times.
 *
 * The type system catches most of it now: a lookup hands back a `ValidatorFn`
 * with no tags to filter on. This guard closes what types cannot — the
 * enumerator is `@internal` by convention rather than by compiler, and a
 * recomposition through `registeredTypes` returns tagged declarations and
 * would compile.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { atLeast, srcRoot, walk } from './testing/ruleNameScrape.js';

/** The module the discipline belongs to, and the class that defines it. */
const OWNERS = ['linter/registryPopulation.ts', 'linter/ValidatorRegistry.ts'];

/**
 * This file. It has to spell every identifier it bans, so scanning itself
 * reports the scanner. Excluded by path rather than by an `ALLOWED` entry,
 * because it is not a subject that earned an exemption.
 */
const SELF = 'linter/populationDiscipline.guard.test.ts';

/**
 * Files allowed to name a population enumerator beside `declarationFor`, each
 * with the reason. Stale-checked below: an entry that no longer needs the
 * exemption is a failure, not a courtesy, because it pre-forgives whatever is
 * written under that path next.
 */
const ALLOWED: Record<string, string> = {
  'linter/registryPopulation.test.ts': 'the module’s own tests, which drive both halves',
  'linter/boundGrounding.test.ts':
    'asserts a removal is absent from the declaring population, then point-probes that removal’s own grounding',
  'linter/validatorAccepts.test.ts':
    'compares the declaring type list against the full validator population, then reads one named slot’s prose',
};

/**
 * Every `.ts`/`.tsx` in the package, TESTS INCLUDED — unlike `allSourceFiles`,
 * which excludes them by design. Every registry-wide sweep there has ever been
 * is a test, so a scan that skipped them would be scanning past its subject.
 */
const everyFile = (): string[] =>
  atLeast(
    walk(srcRoot, (name) => /\.tsx?$/.test(name)),
    1500,
    'populationDiscipline scan'
  );

/**
 * The offence, spelled once: a file that enumerates a population AND reads a
 * declaration off it has rebuilt the roots-only walk. Two spellings of this can
 * drift, which is how a scraping guard here has lost its bite before.
 */
const namesBothHalves = ({ body }: { body: string }): boolean =>
  body.includes('registeredTypes') && body.includes('declarationFor');

const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');

/** Every identifier any arm below asks about. */
const TELLS = ['typesWithRegistrations', 'getTypesWithRemovals', 'registeredTypes', 'declarationFor', 'getOwnKeys', 'findValidator'];

/**
 * Raw text first, comments stripped only for a file that can possibly hit.
 *
 * `stripComments` blanks characters in place and never inserts text, so a raw
 * miss can never become a stripped hit — the prefilter is sound by
 * construction. 271 of 3,355 files carry any of these names; stripping all of
 * them cost ~425ms per core run and retained 12.6 MB for six `includes`.
 */
function scanned(): { at: string; body: string }[] {
  const out: { at: string; body: string }[] = [];
  for (const file of everyFile()) {
    const raw = readFileSync(file, 'utf8');
    if (!TELLS.some((tell) => raw.includes(tell))) continue;
    out.push({ at: label(file), body: stripComments(raw) });
  }
  return out;
}

describe('enumerating the registry belongs to one module', () => {
  const files = scanned().filter(({ at }) => at !== SELF);

  it('scans a population that cannot quietly empty', () => {
    // A rename that moved these files out of the scrape would otherwise leave
    // the guard passing over nothing — the way this repo has lost a scraping
    // guard before.
    // `everyFile` already floors the WALK at 1500; this floors what survives the
    // prefilter, so a rename of every tell would empty the scan loudly.
    expect(files.length).toBeGreaterThan(100);
    for (const owner of OWNERS) {
      expect(files.some(({ at }) => at === owner), `${owner} is outside the scan`).toBe(true);
    }
  });

  it.each(['typesWithRegistrations', 'getTypesWithRemovals'])(
    'keeps the %s enumerator inside the two files that define the seam',
    (enumerator) => {
      // BOTH doors: a discipline enforced on one of two equivalent enumerators
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
   * Widening a lookup back into a declaration, in the two spellings source text
   * can see: the assertion, and the annotated assignment.
   *
   * Honest limit: `PropertyValidator` is an intersection of a call signature
   * with all-OPTIONAL tags, so `ValidatorFn` is structurally assignable to it
   * and passing a lookup straight into a `PropertyValidator`-typed slot needs
   * neither spelling. Only a branded `PropertyValidator` closes that, and
   * branding costs 84 errors across 56 files. These two arms catch the
   * deliberate widening; the slot case is open and stated rather than implied.
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
    // The positive control this arm went without: every other arm here is an
    // equality or has a floor, and a pattern that matches nothing passes
    // whether or not the offence exists.
    const cast = 'const v = findValidator(t, k) as PropertyValidator;';
    const annotated = 'const v: PropertyValidator | null = findValidator(t, k);';
    for (const sample of [cast, annotated]) {
      expect(LAUNDERS.some((re) => re.test(sample)), sample).toBe(true);
    }
    expect(LAUNDERS.some((re) => re.test('const v = findValidator(t, k);'))).toBe(false);
    // A new validator whose BODY calls a lookup is not a widening of one —
    // `boneconstraint3d/linterParser.ts` delegates exactly like this.
    const delegate =
      'const d: PropertyValidator = (key, value, line) => ' +
      'validatorRegistry.findValidator(T, key)?.(key, value, line) ?? null;';
    expect(LAUNDERS.some((re) => re.test(delegate))).toBe(false);
  });

  it('leaves the scaffolded slice shape alone', () => {
    // `getOwnKeys` beside `declarationFor` is the legitimate single-type shape
    // the scaffolder emits, in ~20 slice tests and growing. Banning it would
    // make the guard fire on the population it is supposed to protect.
    const sliceShape = files.filter(
      ({ body }) => body.includes('getOwnKeys') && body.includes('declarationFor')
    );
    expect(sliceShape.length).toBeGreaterThan(5);
  });
});
