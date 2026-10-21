/**
 * A keyed corpus fetches again only when its recipe changes, and keeps no key for a vendoring
 * that kept an older corpus.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureKeyedCorpora, recipeKey } from './vendor-keyed.mjs';

const RECIPE = ['scripts/vendor-git.mjs', 'scripts/vendor-prune.mjs'];

let dir;
let corpus;

/** The options for one corpus under `dir`, vendored by `vendor`. */
function keyed(vendor) {
  return { label: 'test', corpora: [corpus], recipe: RECIPE, lockFile: join(dir, '.lock'), vendor };
}

/** A vendoring that writes the corpus, as a real one does. */
function writeCorpus() {
  mkdirSync(corpus, { recursive: true });
  return true;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vendor-keyed-'));
  corpus = join(dir, 'corpus');
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe('recipeKey', () => {
  it('changes with the set of files', () => {
    expect(recipeKey(RECIPE)).not.toBe(recipeKey(RECIPE.slice(0, 1)));
  });

  it('reads a folder as every file in it', () => {
    expect(recipeKey(['scripts/godot-dfg'])).toBe(recipeKey(['scripts/godot-dfg/bake-dfg.mjs']));
  });
});

describe('ensureKeyedCorpora', () => {
  it('vendors a corpus that holds no key, then records the recipe key in it', () => {
    const vendor = vi.fn(writeCorpus);
    ensureKeyedCorpora(keyed(vendor));
    expect(vendor).toHaveBeenCalledTimes(1);
    expect(readFileSync(join(corpus, '.vendor-key'), 'utf8')).toBe(recipeKey(RECIPE));
  });

  it('fetches nothing for a corpus that holds the current key', () => {
    ensureKeyedCorpora(keyed(writeCorpus));
    const vendor = vi.fn(writeCorpus);
    ensureKeyedCorpora(keyed(vendor));
    expect(vendor).not.toHaveBeenCalled();
  });

  it('vendors again for a corpus that holds an older key', () => {
    ensureKeyedCorpora(keyed(writeCorpus));
    writeFileSync(join(corpus, '.vendor-key'), 'older');
    const vendor = vi.fn(writeCorpus);
    ensureKeyedCorpora(keyed(vendor));
    expect(vendor).toHaveBeenCalledTimes(1);
  });

  it('records no key when the vendoring kept an older corpus (edge case)', () => {
    ensureKeyedCorpora(keyed(() => false));
    expect(existsSync(join(corpus, '.vendor-key'))).toBe(false);
  });

  it('releases the lock when the vendoring throws (error case)', () => {
    expect(() =>
      ensureKeyedCorpora(
        keyed(() => {
          throw new Error('offline');
        })
      )
    ).toThrow('offline');
    expect(existsSync(join(dir, '.lock'))).toBe(false);
  });
});
