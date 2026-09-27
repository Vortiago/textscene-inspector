/**
 * The `@types/vscode` floor equals the `engines.vscode` floor. Newer typings admit APIs the oldest
 * supported VS Code lacks, and `vsce package` refuses such a manifest. This test fails in the unit
 * tests, before the packaging step does.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')
) as {
  engines: { vscode: string };
  devDependencies: Record<string, string>;
};

/** The `major.minor` a caret or tilde range starts at, or null for any other shape. */
function rangeFloor(range: string): string | null {
  const match = /^[~^]?(\d+)\.(\d+)\.\d+$/.exec(range.trim());
  return match ? `${match[1]}.${match[2]}` : null;
}

describe('rangeFloor', () => {
  it('reads the floor of a caret, a tilde and a bare version', () => {
    expect(rangeFloor('^1.85.0')).toBe('1.85');
    expect(rangeFloor('~1.85.3')).toBe('1.85');
    expect(rangeFloor('1.138.0')).toBe('1.138');
  });

  it('refuses a range whose floor it cannot read', () => {
    expect(rangeFloor('*')).toBeNull();
    expect(rangeFloor('>=1.85.0 <2')).toBeNull();
    expect(rangeFloor('catalog:')).toBeNull();
  });
});

describe('VS Code API typings', () => {
  it('start at the oldest VS Code the extension supports', () => {
    const engine = rangeFloor(manifest.engines.vscode);
    const typings = rangeFloor(manifest.devDependencies['@types/vscode'] ?? '');
    expect(engine).not.toBeNull();
    expect(typings).toBe(engine);
  });
});
