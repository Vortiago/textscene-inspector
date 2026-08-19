/**
 * Fixtures contract.
 *
 * Witnesses that the six `unit-*.tscn` fixtures exist, parse via the real
 * TscnParser, and carry the representative shape the slice calls for. This
 * gates the fiddly Godot serialization on actual parsed values — not just file
 * existence.
 *
 * Nothing pins the SIZE or the SUBJECT of the co-located parser/Component
 * suites. A frozen path roster carrying a `minCases` count and a substring
 * `mentions` list cannot: an empty `it` counts as a case and a token in a
 * comment pays for the subject, so a suite replaced wholesale by stubs reads as
 * complete — while merging two real cases into one `it.each` falls under the
 * count and reads as a regression. Suite quality is judged at /code-review; the
 * mechanical pins are this file's fixtures and the registry sweeps in
 * `linter/ruleCoverage.test.ts`.
 *
 * Repo root is resolved by walking up to pnpm-workspace.yaml so the test is
 * insensitive to its own depth.
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene, TscnNode } from '../../parser/types';

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found above this test');
}

const fixturesDir = resolve(repoRoot(), 'scenes/fixtures');

function flatten(scene: TscnScene): TscnNode[] {
  const out: TscnNode[] = [];
  const walk = (n: TscnNode): void => {
    out.push(n);
    n.children.forEach(walk);
  };
  scene.nodes.forEach(walk);
  return out;
}

function parseFixture(file: string): { scene: TscnScene; raw: string } {
  const f = resolve(fixturesDir, file);
  if (!existsSync(f)) throw new Error(`fixture missing: scenes/fixtures/${file}`);
  const raw = readFileSync(f, 'utf8');
  return { scene: new TscnParser().parse(raw), raw };
}

const BODIES_2D: ReadonlyArray<{ file: string; bodyType: string }> = [
  { file: 'unit-area2d.tscn', bodyType: 'Area2D' },
  { file: 'unit-rigidbody2d.tscn', bodyType: 'RigidBody2D' },
  { file: 'unit-staticbody2d.tscn', bodyType: 'StaticBody2D' },
  { file: 'unit-characterbody2d.tscn', bodyType: 'CharacterBody2D' },
];

describe('#162 fixtures contract — 2D physics bodies', () => {
  for (const { file, bodyType } of BODIES_2D) {
    it(`${file} parses with a ${bodyType}, a CollisionShape2D, and a renderable child`, () => {
      const { scene } = parseFixture(file);
      const types = flatten(scene).map((n) => n.type);
      expect(types).toContain(bodyType);
      expect(types).toContain('CollisionShape2D');
      // The issue asks each body fixture to carry a visible Sprite2D/ColorRect.
      expect(types.some((t) => t === 'Sprite2D' || t === 'ColorRect')).toBe(true);
    });
  }
});

describe('#162 fixtures contract — transform-only 3D nodes', () => {
  it('unit-skeleton3d.tscn parses with a Skeleton3D node and a transform', () => {
    const { scene, raw } = parseFixture('unit-skeleton3d.tscn');
    expect(flatten(scene).map((n) => n.type)).toContain('Skeleton3D');
    expect(raw).toContain('Transform3D(');
  });

  it('unit-gpuparticles3d.tscn parses with a GPUParticles3D node + a ParticleProcessMaterial sub-resource', () => {
    const { scene, raw } = parseFixture('unit-gpuparticles3d.tscn');
    expect(flatten(scene).map((n) => n.type)).toContain('GPUParticles3D');
    expect(scene.internalResources.map((r) => r.type)).toContain('ParticleProcessMaterial');
    expect(raw).toContain('process_material = SubResource(');
  });
});
