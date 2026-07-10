/**
 * #166 fixtures contract: the slice ships unit-*.tscn fixtures for ColorRect,
 * the 2D UI Label, and VBoxContainer under scenes/fixtures (named `unit-*` so
 * generate:fixtures categorizes them as "Unit - 2D UI Controls"). Resolves the
 * repo root by walking up to pnpm-workspace.yaml — same pattern as
 * controls131-fixtures.test.ts.
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

describe('#166 control fixtures', () => {
  it('ships unit-color-rect.tscn containing a ColorRect node', () => {
    const f = resolve(fixtures, 'unit-color-rect.tscn');
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8')).toContain('type="ColorRect"');
  });

  it('ships unit-label-2d.tscn containing a (2D UI) Label node', () => {
    const f = resolve(fixtures, 'unit-label-2d.tscn');
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8')).toContain('type="Label"');
  });

  it('ships unit-vbox-container.tscn containing a VBoxContainer node', () => {
    const f = resolve(fixtures, 'unit-vbox-container.tscn');
    expect(existsSync(f)).toBe(true);
    expect(readFileSync(f, 'utf8')).toContain('type="VBoxContainer"');
  });
});
