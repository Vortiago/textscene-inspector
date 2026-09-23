/**
 * A rule reads an integer property through `ruleInt`, never `parseGodotInt`,
 * whose `null` (unreadable) and `NaN` (unstorable) a rule cannot use. NaN fails
 * every comparison, so a rule that gates on `!== null` reports nothing.
 * `ruleInt` collapses both to `null`, and this sweep keeps every reader on it.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';

/**
 * A rule is a file that produces a diagnostic, so it names `Diagnostic` or
 * `ParseError`. Read from the source, not the path, since a decoder can live in
 * a slice and what a file returns does not move with it.
 */
const PRODUCES_DIAGNOSTIC = /\b(?:Diagnostic|ParseError)\b/;

// The validator layer produces diagnostics but owns the three-outcome reader:
// turning the unstorable signal into a diagnostic is its job.
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
    // All three: `asStoredInt` and `storedFromFloat` return the same NaN, and
    // the barrel exports them. Comment-stripped, since prose naming the reader
    // is not a call to it.
    const offenders = files
      .filter(({ src }) =>
        /\b(?:parseGodotInt|asStoredInt|storedFromFloat)\s*\(/.test(stripComments(src))
      )
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });
});
