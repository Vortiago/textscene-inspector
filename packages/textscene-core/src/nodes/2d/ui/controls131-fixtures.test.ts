/**
 * Fixtures contract: the slice ships unit-*.tscn fixtures for OptionButton and
 * CheckBox under scenes/fixtures (named `unit-*` so generate:fixtures categorizes them
 * as "Unit - 2D UI Controls"). Resolves the repo root by walking up to pnpm-workspace.yaml.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found above this test');
}

const fixtures = resolve(repoRoot(), 'scenes/fixtures');

describe('#131 control fixtures', () => {
  it('ships unit-optionbutton.tscn containing an OptionButton node', () => {
    const f = resolve(fixtures, 'unit-optionbutton.tscn');
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8')).toContain('type="OptionButton"');
  });

  it('ships unit-checkbox.tscn containing a CheckBox node', () => {
    const f = resolve(fixtures, 'unit-checkbox.tscn');
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8')).toContain('type="CheckBox"');
  });
});
