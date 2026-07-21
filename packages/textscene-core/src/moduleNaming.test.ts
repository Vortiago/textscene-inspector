/**
 * No two modules in a directory may differ only by case.
 *
 * This has bitten twice: `previewLighting.ts` beside `PreviewLighting.tsx`,
 * and `godotEditorControls.ts` beside `GodotEditorControls.tsx`. Both compile,
 * both type-check, both pass the unit suite and the visual gate — and both
 * break only when esbuild bundles the VS Code host, where the pure module's
 * specifier resolves to the component instead and every named import from it
 * disappears at once.
 *
 * A component and the pure module behind it naturally want the same name, so
 * the collision is easy to reach and expensive to diagnose from the error it
 * produces ("No matching export ..." pointing at the wrong file). Catch it in
 * the fast suite instead.
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
