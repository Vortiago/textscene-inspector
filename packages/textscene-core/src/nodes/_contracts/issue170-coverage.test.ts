/**
 * #170 (parser subset) coverage contract — RED until the slice ships.
 *
 * Issue #170 bundles six independent unit-test gaps. This slice carves the two
 * PURE-PARSER items (no R3F, no fixtures, no mocking):
 *   1. the base Node parser — a NEW co-located `node/parser.test.ts` covering
 *      parseNode(): name / parent / instance (raw ExtResource ref) / index /
 *      complex parent path / malformed instance / optional transform valid+malformed.
 *   6. Camera2D parser edge cases — EXPAND the existing 3-case `camera2d/parser.test.ts`
 *      with zoom (fractional / zero / negative / scientific), offset (zero / large /
 *      mixed-sign), position (large / negative) and the anchor_mode default.
 *
 * The behaviour under test already ships (parseNode / parseCamera2D are implemented),
 * so a behavioural witness would be green on day one — the only honest RED lever for a
 * test-writing slice is COMPLETENESS: the required suites must exist, carry enough
 * cases, and reference the function under test. QUALITY (distinguishing, non-padding,
 * real edge values) is judged at /code-review, not here. `mentions` is checked with
 * `.every` (all required) so the file can't satisfy the pin by referencing an
 * unrelated symbol.
 *
 * The other four items (CSGCylinder3D render, CollisionShape3D gizmo edges, modulate
 * cascade, negative-scale decomposition) need R3F + lazy-import mocking and ship as a
 * separate slice.
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

const root = repoRoot();
const CORE = 'packages/textscene-core/src/nodes';

const REQUIRED: ReadonlyArray<{ path: string; minCases: number; mentions: string[] }> = [
  // NEW file — must cover the Node-specific `index` attribute (Node3D's parser omits it).
  { path: `${CORE}/node/parser.test.ts`, minCases: 7, mentions: ['parseNode', 'index'] },
  // EXPAND from 3 cases — the jump to 8 forces the zoom/offset/position/anchor_mode edges.
  { path: `${CORE}/2d/camera2d/parser.test.ts`, minCases: 8, mentions: ['parseCamera2D', 'anchor_mode', 'zoom', 'offset'] },
];

function countCases(src: string): number {
  return (src.match(/\b(it|test)\s*\(/g) || []).length;
}

describe('#170 coverage contract — required parser suites exist', () => {
  for (const r of REQUIRED) {
    it(`${r.path} exists with >=${r.minCases} cases and references its subject`, () => {
      const f = resolve(root, r.path);
      expect(existsSync(f)).toBe(true);
      const src = readFileSync(f, 'utf8');
      expect(countCases(src)).toBeGreaterThanOrEqual(r.minCases);
      expect(r.mentions.every((m) => src.includes(m))).toBe(true);
    });
  }
});
