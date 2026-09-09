/**
 * Vehicle slices contract (RED until the slices ship).
 *
 * Pins the shape of the fixture the VehicleBody3D / VehicleWheel3D slices are
 * judged against, on actual parsed values rather than file existence. The wheels
 * must sit at DISTINCT transforms: a body whose wheels all share one origin
 * would render identically whether the transform survived the parse or not, so
 * a single-wheel fixture could not tell the two apart.
 *
 * Repo root is resolved by walking up to pnpm-workspace.yaml so the test is
 * insensitive to its own depth.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { TscnParser } from '../../parser/TscnParser';
import { fixturesDir } from '../../parser/testing/parserKit';
import type { TscnScene, TscnNode } from '../../parser/types';
import type { Node3DProperties } from '../base/node3d/types';

const FIXTURE = 'unit-physics-vehicle.tscn';

function flatten(scene: TscnScene): TscnNode[] {
  const out: TscnNode[] = [];
  const walk = (n: TscnNode): void => {
    out.push(n);
    n.children.forEach(walk);
  };
  scene.nodes.forEach(walk);
  return out;
}

function parseFixture(): TscnScene {
  const f = resolve(fixturesDir(), FIXTURE);
  if (!existsSync(f)) throw new Error(`fixture missing: scenes/fixtures/${FIXTURE}`);
  return new TscnParser().parse(readFileSync(f, 'utf8'));
}

describe('#352 fixtures contract — Truck Town vehicle types', () => {
  it(`${FIXTURE} parses with a VehicleBody3D carrying a physics material override`, () => {
    const scene = parseFixture();
    const nodes = flatten(scene);
    const bodies = nodes.filter((n) => n.type === 'VehicleBody3D');
    expect(bodies).toHaveLength(1);
    expect(nodes.map((n) => n.type)).toContain('CollisionShape3D');
    expect(nodes.map((n) => n.type)).toContain('MeshInstance3D');

    // The override is what makes this fixture exercise dangling-resource-reference
    // at all, and VehicleBody3D reuses parseNode3D — so it survives only in the
    // raw body, and only against a PhysicsMaterial the scene actually defines.
    const override = bodies[0]!.rawProperties?.physics_material_override;
    expect(override).toBe('SubResource("PhysicsMaterial_tyres")');
    expect(scene.internalResources.map((r) => `${r.type}:${r.id}`)).toContain(
      'PhysicsMaterial:PhysicsMaterial_tyres'
    );
  });

  it(`${FIXTURE} carries at least two VehicleWheel3D at distinct origins`, () => {
    const wheels = flatten(parseFixture()).filter((n) => n.type === 'VehicleWheel3D');
    expect(wheels.length).toBeGreaterThanOrEqual(2);

    const origins = wheels.map((w) => {
      const origin = (w.properties as Node3DProperties).transform?.origin;
      expect(origin).toBeDefined();
      return `${origin!.x},${origin!.y},${origin!.z}`;
    });
    expect(new Set(origins).size).toBe(wheels.length);
  });
});
