/**
 * #162 coverage contract (RED until the slice ships).
 *
 * The six co-located test files issue #162 asks for must exist, carry a minimum
 * number of cases, and reference the node type / shared parser they cover. This
 * pins COMPLETENESS (no dropped slice) — the QUALITY of those tests (distinguishing,
 * adversarial, not stubs) is judged at /code-review, not here.
 *
 * Note for the implementer: the physics bodies reuse parseNode2D and Skeleton3D/
 * GPUParticles3D reuse parseNode3D — there is no per-node parser. The "parser"
 * suites therefore test the shared parser + registration wiring through each node
 * type, NOT new parsing of physics-only props (collision_layer/monitoring/… are
 * linter-validated and already covered).
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
  { path: `${CORE}/physics/2d/parser.test.ts`, minCases: 3, mentions: ['Area2D', 'parseNode2D'] },
  { path: `${CORE}/physics/2d/Component.test.tsx`, minCases: 3, mentions: ['ReactThreeTestRenderer', 'Node2D', 'Area2D'] },
  { path: `${CORE}/3d/skeleton3d/parser.test.ts`, minCases: 3, mentions: ['Skeleton3D', 'parseNode3D'] },
  { path: `${CORE}/3d/skeleton3d/Component.test.tsx`, minCases: 2, mentions: ['Skeleton3D', 'Node3D'] },
  { path: `${CORE}/3d/particles/gpuparticles3d/parser.test.ts`, minCases: 3, mentions: ['GPUParticles3D', 'parseNode3D'] },
  { path: `${CORE}/3d/particles/gpuparticles3d/Component.test.tsx`, minCases: 2, mentions: ['GPUParticles3D', 'Node3D'] },
];

function countCases(src: string): number {
  return (src.match(/\b(it|test)\s*\(/g) || []).length;
}

describe('#162 coverage contract — required test suites exist', () => {
  for (const r of REQUIRED) {
    it(`${r.path} exists with >=${r.minCases} cases and references its subject`, () => {
      const f = resolve(root, r.path);
      expect(existsSync(f)).toBe(true);
      const src = readFileSync(f, 'utf8');
      expect(countCases(src)).toBeGreaterThanOrEqual(r.minCases);
      expect(r.mentions.some((m) => src.includes(m))).toBe(true);
    });
  }
});
