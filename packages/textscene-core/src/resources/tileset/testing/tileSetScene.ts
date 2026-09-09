/**
 * The scene shape every TileSet linter test asserts against.
 *
 * A TileSet arrives as a `[sub_resource]` (or a `.tres`, which the linter reads
 * through the same validator lookup), so one sub-resource block beside a root
 * node is the whole fixture. Kept out of the test files because the family tests
 * each need the SAME line number for the property under test, and a fixture
 * spelled per file drifts on that immediately.
 *
 * Under a `testing` directory because it imports the test kit: `tsconfig.json`
 * excludes every such directory from the build but not a plain `.ts` beside a
 * test, so a helper spelled as a sibling fails `tsc --build` while every vitest
 * run stays green.
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
 * By CONTENT rather than by property name: a leaf validator names the leaf
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
