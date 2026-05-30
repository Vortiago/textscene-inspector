/**
 * Archaeology: ported from main:packages/textscene-core/src/nodes/base/node3d/renderer.test.ts
 *
 * Original tested `createNode3DGizmo` and `applyNode3DTransform` (both deleted in R3F migration).
 * Ported to test equivalent behaviour via the <Node3D> R3F component.
 *
 * NOTE: The rotation test (#3) uses the same Godot transform from the original.
 * The original asserted rotation.y = +π/2 (90°). With the col-major decompose that was
 * correct on main, but 99c1479 introduced row-major Matrix4.set(), making the current
 * code produce +π/2 for this input via a transpose accident.  We record BOTH the
 * original assertion and the current output so the failure (if any) is documented.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node3D } from '../../nodes/base/node3d/Component';
import type { TscnNode } from '../../parser/types';
import type { Node3DProperties } from '../../nodes/base/node3d/types';

function makeNode(properties: Node3DProperties): TscnNode {
  return {
    name: properties.name ?? 'TestNode',
    type: 'Node3D',
    children: [],
    properties,
  };
}

async function renderNode3D(properties: Node3DProperties) {
  const node = makeNode(properties);
  const renderer = await ReactThreeTestRenderer.create(<Node3D node={node} />);
  return renderer.scene.findByProps({ name: node.name }).instance;
}

describe('Node3D (ported from node3d/renderer.test.ts — createNode3DGizmo equivalent)', () => {
  it('renders an empty group with the node name', async () => {
    const group = await renderNode3D({ name: 'TestNode' });
    expect(group).toBeDefined();
    expect(group.name).toBe('TestNode');
  });

  it('sets the correct name', async () => {
    const group = await renderNode3D({ name: 'MyNode3D' });
    expect(group.name).toBe('MyNode3D');
  });
});

describe('Node3D (ported from applyNode3DTransform tests)', () => {
  it('applies position from transform', async () => {
    const group = await renderNode3D({
      name: 'pos',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 5, y: 10, z: 15 },
      },
    });
    expect(group.position.x).toBeCloseTo(5);
    expect(group.position.y).toBeCloseTo(10);
    expect(group.position.z).toBeCloseTo(15);
  });

  it('applies scale from transform', async () => {
    const group = await renderNode3D({
      name: 'scale',
      transform: {
        basis_x: { x: 2, y: 0, z: 0 },
        basis_y: { x: 0, y: 3, z: 0 },
        basis_z: { x: 0, y: 0, z: 4 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.scale.x).toBeCloseTo(2);
    expect(group.scale.y).toBeCloseTo(3);
    expect(group.scale.z).toBeCloseTo(4);
  });

  it('applies rotation from transform — original: 90° around Y, asserts rotation.y = +π/2', async () => {
    // Godot Basis for Ry(+90°). In Godot `Basis` stores `Vector3 rows[3]`:
    //   row0 = (0, 0, 1)   row1 = (0, 1, 0)   row2 = (-1, 0, 0)
    // The original renderer.test.ts used this exact basis and asserted rotation.y = +π/2.
    //
    // With col-major Matrix4.set (correct, pre-99c1479):
    //   columns: [0,0,-1], [0,1,0], [1,0,0]  → Ry(-90°) → rotation.y = -π/2
    //
    // With row-major Matrix4.set (99c1479 "fix"):
    //   rows: [0,0,1], [0,1,0], [-1,0,0]  → stored as col-major by THREE → Ry(+90°) → rotation.y = +π/2
    //
    // The original assertion +π/2 only holds under 99c1479's row-major bug.
    // PASS here = 99c1479 row-major active (WRONG transform semantics).
    // FAIL here = col-major active (CORRECT transform semantics, rotation actually -π/2).
    const group = await renderNode3D({
      name: 'rot-y',
      transform: {
        basis_x: { x: 0, y: 0, z: 1 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: -1, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.rotation.x).toBeCloseTo(0, 5);
    expect(group.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    expect(group.rotation.z).toBeCloseTo(0, 5);
  });

  it('handles identity transform', async () => {
    const group = await renderNode3D({
      name: 'identity',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.position.x).toBeCloseTo(0);
    expect(group.position.y).toBeCloseTo(0);
    expect(group.position.z).toBeCloseTo(0);
    expect(group.rotation.x).toBeCloseTo(0);
    expect(group.rotation.y).toBeCloseTo(0);
    expect(group.rotation.z).toBeCloseTo(0);
    expect(group.scale.x).toBeCloseTo(1);
    expect(group.scale.y).toBeCloseTo(1);
    expect(group.scale.z).toBeCloseTo(1);
  });

  it('handles missing transform (no-op — identity defaults)', async () => {
    const group = await renderNode3D({ name: 'no-transform' });
    expect(group.position.x).toBe(0);
    expect(group.position.y).toBe(0);
    expect(group.position.z).toBe(0);
    expect(group.rotation.x).toBe(0);
    expect(group.rotation.y).toBe(0);
    expect(group.rotation.z).toBe(0);
    expect(group.scale.x).toBe(1);
    expect(group.scale.y).toBe(1);
    expect(group.scale.z).toBe(1);
  });

  it('handles combined transform (position + scale)', async () => {
    const group = await renderNode3D({
      name: 'combined',
      transform: {
        basis_x: { x: 2, y: 0, z: 0 },
        basis_y: { x: 0, y: 2, z: 0 },
        basis_z: { x: 0, y: 0, z: 2 },
        origin: { x: 1, y: 2, z: 3 },
      },
    });
    expect(group.position.x).toBeCloseTo(1);
    expect(group.position.y).toBeCloseTo(2);
    expect(group.position.z).toBeCloseTo(3);
    expect(group.scale.x).toBeCloseTo(2);
    expect(group.scale.y).toBeCloseTo(2);
    expect(group.scale.z).toBeCloseTo(2);
  });
});
