/**
 * A RULE reads an integer property through `ruleInt`, never `parseGodotInt`.
 *
 * `parseGodotInt` has three outcomes and a rule can only act on one of them.
 * `null` says the tokenizer could not read the text; `NaN` says it read but no
 * 32-bit slot holds it. NaN clears `<`, `>` and `>=` in both directions, so a
 * rule that gates on `!== null` and then compares reports nothing at all — the
 * shape that took `sprite2d-frame-range` silent for `hframes = inf`, in the
 * same function whose `frame_coords` half had just been fixed.
 *
 * Sweeping rather than fixing the two named sites: there are 50-odd rule-layer
 * readers, the defect is invisible in a green suite, and the next slice would
 * reintroduce it. `ruleInt` collapses both signals to `null`, which is the only
 * thing a rule can do with either.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';

/**
 * A rule is a file that PRODUCES a diagnostic, which it cannot do without
 * naming `Diagnostic` or `ParseError`.
 *
 * Derived from the source rather than from the path. The predicate was a list
 * of exempt directories on the stated principle that "decoders take their own
 * documented fallback" — true, but `nodes/2d/tiles/shared/tileData.ts` is a
 * decoder living in a slice, so it fell into the rule layer the moment it
 * needed to tell an unreadable element from an unstorable one. A path list
 * re-decides that question every time a file moves; what a file returns does
 * not move with it.
 *
 * The validator layer is excluded even though it does produce diagnostics: it
 * OWNS the three-outcome reader, and turning the unstorable signal into a
 * diagnostic is precisely its job.
 */
const PRODUCES_DIAGNOSTIC = /\b(?:Diagnostic|ParseError)\b/;

function ownsTheReader(rel: string): boolean {
  return (
    rel.startsWith('linter/validators/') || rel.startsWith('godot/') || rel.endsWith('linterParser.ts')
  );
}

describe('rule-layer integer reads', () => {
  const files = allSourceFiles()
    .map((file) => ({ file, rel: file.slice(srcRoot.length + 1), src: readFileSync(file, 'utf8') }))
    .filter(({ rel, src }) => !ownsTheReader(rel) && PRODUCES_DIAGNOSTIC.test(src));

  it('finds the rule files, so an empty sweep cannot pass this', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some(({ rel }) => rel.endsWith('nodes/2d/sprite2d/linter.ts'))).toBe(true);
    // And leaves the decoders out: they answer "can the previewer draw this",
    // and need the unreadable/unstorable split to choose their fallback.
    expect(files.some(({ rel }) => rel.endsWith('tiles/shared/tileData.ts'))).toBe(false);
  });

  it('never calls a reader that can hand back NaN', () => {
    // All three, not just `parseGodotInt`: `asStoredInt` and `storedFromFloat`
    // return the same NaN, and the barrel exports them. Guarding one name by
    // spelling while its siblings sit beside it on the same import is how the
    // fence gets walked around.
    //
    // Comment-stripped, like its sibling guards: prose naming the reader is not
    // a call to it.
    const offenders = files
      .filter(({ src }) =>
        /\b(?:parseGodotInt|asStoredInt|storedFromFloat)\s*\(/.test(stripComments(src))
      )
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });
});
