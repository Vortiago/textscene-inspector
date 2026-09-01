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

const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');
const bodyOf = (file: string): string => stripComments(readFileSync(file, 'utf8'));

describe('enumerating the registry belongs to one module', () => {
  const files = everyFile()
    .map((file) => ({ at: label(file), body: bodyOf(file) }))
    .filter(({ at }) => at !== SELF);

  it('scans a population that cannot quietly empty', () => {
    // A rename that moved these files out of the scrape would otherwise leave
    // the guard passing over nothing — the way this repo has lost a scraping
    // guard before.
    expect(files.length).toBeGreaterThan(1500);
    for (const owner of OWNERS) {
      expect(files.some(({ at }) => at === owner), `${owner} is outside the scan`).toBe(true);
    }
  });

  it('keeps the raw enumerator inside the two files that define the seam', () => {
    const reached = files
      .filter(({ body }) => body.includes('typesWithRegistrations'))
      .map(({ at }) => at)
      .sort();
    expect(reached).toEqual([...OWNERS].sort());
  });

  it('lets nobody else recompose a population and then read declarations off it', () => {
    // `registeredTypes(...) x getOwnKeys x declarationFor` is the one spelling
    // that still type-checks all the way to a tag. Naming both halves in one
    // file is the tell.
    const offenders = files
      .filter(({ at }) => !OWNERS.includes(at) && !(at in ALLOWED))
      .filter(({ body }) => body.includes('registeredTypes') && body.includes('declarationFor'))
      .map(({ at }) => at);
    expect(
      offenders,
      'ask `everyValidator` for the validator population; it cannot stop at the roots'
    ).toEqual([]);
  });

  it('holds no exemption that exempts nothing', () => {
    const stale = Object.keys(ALLOWED).filter((at) => {
      const file = files.find((f) => f.at === at);
      return !file || !(file.body.includes('registeredTypes') && file.body.includes('declarationFor'));
    });
    expect(stale).toEqual([]);
  });

  it('never casts a lookup back into a declaration', () => {
    const offenders = files
      .filter(({ at }) => !OWNERS.includes(at))
      .filter(({ body }) => /findValidator\([^)]*\)[^;]*\bas\s+PropertyValidator\b/.test(body))
      .map(({ at }) => at);
    expect(offenders).toEqual([]);
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
