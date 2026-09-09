/**
 * The scrape's own blind spots.
 *
 * `stripEmits` removes each `emits: [ … ]` block so the guard reads what
 * `check` REPORTS rather than what the rule DECLARES. The two sets are then
 * compared, so a strip that ends at the wrong offset makes them agree by
 * construction: the declaration is scraped as if it were an emission, and an
 * invented or dead row stops being catchable.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scrapePairs, stripEmits } from './emitsScrape.js';

/** A diagnostic the check function really does report, after the emits block. */
const EMITTED = `push({ severity: 'error', ruleName: 'really-emitted' });`;

describe('stripEmits', () => {
  it('removes a one-line block', () => {
    const src = `{ emits: [{ ruleName: 'declared-only', severity: 'warning' }] }\n${EMITTED}`;
    expect(stripEmits(src)).not.toContain('declared-only');
    expect(stripEmits(src)).toContain('really-emitted');
  });

  it('removes a block whose grounding prose closes a bracket', () => {
    // `]` in a `because`/`unused` clause is ordinary prose. Counted as a
    // bracket it ends the strip early, leaving the rest of the DECLARATIONS in
    // the text the scrape reads back.
    const src = [
      '{ emits: [',
      `  { ruleName: 'first-declared', severity: 'error',`,
      `    grounding: { kind: 'no-engine-counterpart', because: 'the [gd_scene] header]' } },`,
      `  { ruleName: 'second-declared', severity: 'warning' },`,
      '] }',
      EMITTED,
    ].join('\n');
    const out = stripEmits(src);
    expect(out).not.toContain('first-declared');
    expect(out).not.toContain('second-declared');
    expect(out).toContain('really-emitted');
  });

  it('stops at the block end when the prose opens a bracket', () => {
    // The mirror case: a lone `[` in prose runs the strip past the array and
    // deletes real diagnostics from the scrape.
    const src = [
      '{ emits: [',
      `  { ruleName: 'declared-only', severity: 'error',`,
      `    grounding: { kind: 'engine-inert', at: 'a.cpp:1', unused: 'an unclosed [ here' } },`,
      '] }',
      EMITTED,
    ].join('\n');
    const out = stripEmits(src);
    expect(out).not.toContain('declared-only');
    expect(out).toContain('really-emitted');
  });

  it('keeps nested brackets balanced', () => {
    const src = `{ emits: [...(x ? [{ ruleName: 'conditional', severity: 'error' }] : [])] }\n${EMITTED}`;
    const out = stripEmits(src);
    expect(out).not.toContain('conditional');
    expect(out).toContain('really-emitted');
  });
});

describe('scrapePairs', () => {
  it('reports only what the check function emits, prose brackets and all', () => {
    const dir = mkdtempSync(join(tmpdir(), 'emits-scrape-'));
    const file = join(dir, 'linter.ts');
    writeFileSync(
      file,
      [
        'export const rule = {',
        `  meta: { name: 'r', emits: [`,
        `    { ruleName: 'first-never-reported', severity: 'error',`,
        `      grounding: { kind: 'no-engine-counterpart', because: 'a list item]' } },`,
        `    { ruleName: 'second-never-reported', severity: 'warning' },`,
        '  ] },',
        '  check() {',
        `    const out = [];`,
        `    out.push({ severity: 'warning', ruleName: 'actually-reported' });`,
        '    return out;',
        '  },',
        '};',
      ].join('\n'),
      'utf8'
    );
    expect(scrapePairs(file)).toEqual([{ name: 'actually-reported', severity: 'warning' }]);
  });
});
