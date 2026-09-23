/**
 * No two modules in a directory may differ only by case. Such a pair compiles and
 * passes every gate, but esbuild's VS Code host bundle resolves the pure module's
 * specifier to the component, and every named import from it fails with
 * "No matching export" pointing at the wrong file.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname);

function collisionsIn(dir: string): string[] {
  const found: string[] = [];
  const seen = new Map<string, string>();
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collisionsIn(full));
      continue;
    }
    const key = entry.toLowerCase().replace(/\.(ts|tsx)$/, '');
    const previous = seen.get(key);
    if (previous && previous !== entry) found.push(`${dir}: ${previous} vs ${entry}`);
    else seen.set(key, entry);
  }
  return found;
}

describe('module naming', () => {
  it('has no two modules differing only by case', () => {
    expect(collisionsIn(SRC)).toEqual([]);
  });
});
