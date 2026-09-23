/**
 * The scene every TileSet linter test asserts against: one `[sub_resource]` beside a root node,
 * shared so every family test gets the same line for the property under test. It sits under
 * `testing/` because it imports the test kit: `tsconfig.json` excludes that directory from the
 * build, and a sibling of a test fails `tsc --build` while vitest stays green.
 */

import { expect } from 'vitest';
import { lint, node, scene, subResource } from '../../../linter/testing/testkit.js';
import type { Diagnostic, Severity } from '../../../linter/types.js';

/**
 * A TileSet carrying exactly one property, whose line is always 4:
 * `[gd_scene]`, blank, `[sub_resource]`, the property.
 */
export function tileSetKey(key: string, value: string): string {
  return tileSet({ [key]: value });
}

/** A TileSet carrying several properties, for a key that needs a sibling. */
export function tileSet(props: Record<string, string>): string {
  return scene(subResource('TileSet', props), node('Node3D', {}, { name: 'Root' }));
}

/** The scene lints with no diagnostic at all. */
export function expectClean(content: string): void {
  expect(lint(content)).toEqual([]);
}

/**
 * The scene's single diagnostic, asserted by severity and message substrings.
 *
 * By content rather than by property name: a leaf validator names the leaf
 * (`light_mask`) and never the indexed key it arrived under, so a lookup keyed
 * on the written property would miss every family diagnostic.
 */
export function expectDiagnostic(
  content: string,
  where: { severity: Severity; contains: string[] }
): Diagnostic {
  const diagnostics = lint(content);
  expect(diagnostics).toHaveLength(1);
  const found = diagnostics[0];
  expect(found).toBeDefined();
  expect(found!.severity).toBe(where.severity);
  for (const substring of where.contains) expect(found!.message).toContain(substring);
  return found!;
}
