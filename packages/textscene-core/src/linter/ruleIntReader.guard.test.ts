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

/** The validator layer OWNS the three-outcome reader; everything else is a rule. */
function isRuleLayer(rel: string): boolean {
  if (rel.startsWith('linter/validators/')) return false;
  if (rel.startsWith('godot/')) return false;
  // A slice's own hand-rolled VALIDATOR is the same layer as the DSL: it turns
  // the unstorable signal into a diagnostic rather than comparing it.
  if (rel.endsWith('linterParser.ts')) return false;
  // Decoders answer "can the previewer draw this", not "what did Godot load",
  // and take their own documented fallback for a value they cannot use.
  if (rel.startsWith('parser/') || rel.startsWith('resources/')) return false;
  return true;
}

describe('rule-layer integer reads', () => {
  const files = allSourceFiles()
    .map((file) => ({ file, rel: file.slice(srcRoot.length + 1) }))
    .filter(({ rel }) => isRuleLayer(rel));

  it('finds the rule files, so an empty sweep cannot pass this', () => {
    expect(files.length).toBeGreaterThan(500);
    expect(files.some(({ rel }) => rel.endsWith('nodes/2d/sprite2d/linter.ts'))).toBe(true);
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
      .filter(({ file }) =>
        /\b(?:parseGodotInt|asStoredInt|storedFromFloat)\s*\(/.test(
          stripComments(readFileSync(file, 'utf8'))
        )
      )
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });
});
