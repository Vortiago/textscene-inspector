/**
 * Fixtures contract: the slice ships unit-*.tscn fixtures for ColorRect,
 * the 2D UI Label, and VBoxContainer under scenes/fixtures (named `unit-*` so
 * generate:fixtures categorizes them as "Unit - 2D UI Controls").
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fixturesDir } from '../../../parser/testing/parserKit';

const fixtures = fixturesDir();

const CASES: Array<{ file: string; nodeType: string }> = [
  { file: 'unit-color-rect.tscn', nodeType: 'ColorRect' },
  { file: 'unit-label-2d.tscn', nodeType: 'Label' },
  { file: 'unit-vbox-container.tscn', nodeType: 'VBoxContainer' },
];

describe('#166 control fixtures', () => {
  it.each(CASES)('ships $file containing a $nodeType node', ({ file, nodeType }) => {
    const f = resolve(fixtures, file);
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8')).toContain(`type="${nodeType}"`);
  });
});
