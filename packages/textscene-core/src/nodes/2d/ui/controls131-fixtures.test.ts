/**
 * The unit-*.tscn fixtures for OptionButton and CheckBox exist under scenes/fixtures.
 * The `unit-*` name puts them under "Unit - 2D UI Controls" in generate:fixtures.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fixturesDir } from '../../../parser/testing/parserKit';

describe('#131 control fixtures', () => {
  it('ships unit-optionbutton.tscn containing an OptionButton node', () => {
    const f = resolve(fixturesDir(), 'unit-optionbutton.tscn');
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8')).toContain('type="OptionButton"');
  });

  it('ships unit-checkbox.tscn containing a CheckBox node', () => {
    const f = resolve(fixturesDir(), 'unit-checkbox.tscn');
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8')).toContain('type="CheckBox"');
  });
});
