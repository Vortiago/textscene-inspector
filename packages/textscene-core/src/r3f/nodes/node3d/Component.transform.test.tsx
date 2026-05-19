/**
 * Strict-verification harness (WI-R3F-9, group A) — 10 assertions covering
 * Node3D's transform decomposition. Each assertion exercises ONE property
 * to ground truth on the resulting THREE.Group instance.
 *
 * Assertions: 1–10 of `work_items/STRICT-VERIFICATION.md`.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node3D } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { Node3DProperties, Transform3D } from '../../../nodes/base/node3d/types';

function identityBasis(): Pick<Transform3D, 'basis_x' | 'basis_y' | 'basis_z'> {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
  };
}

function makeNode(properties: Node3DProperties): TscnNode {
  return {
    name: properties.name ?? 'TestNode',
    type: 'Node3D',
    children: [],
    properties,
  };
}

async function renderAt(properties: Node3DProperties) {
  const node = makeNode(properties);
  const renderer = await ReactThreeTestRenderer.create(<Node3D node={node} />);
  return renderer.scene.findByProps({ name: node.name }).instance;
}

describe('Node3D transform (assertions 1–10)', () => {
  it('#1 position.x reflects transform origin x', async () => {
    const group = await renderAt({
      name: 'pos-x',
      transform: { ...identityBasis(), origin: { x: 5, y: 0, z: 0 } },
    });
    expect(group.position.x).toBe(5);
  });

  it('#2 position.y reflects transform origin y', async () => {
    const group = await renderAt({
      name: 'pos-y',
      transform: { ...identityBasis(), origin: { x: 0, y: 7, z: 0 } },
    });
    expect(group.position.y).toBe(7);
  });

  it('#3 position.z reflects transform origin z', async () => {
    const group = await renderAt({
      name: 'pos-z',
      transform: { ...identityBasis(), origin: { x: 0, y: 0, z: -3 } },
    });
    expect(group.position.z).toBe(-3);
  });

  it('#4 rotation.x decoded from basis (radians)', async () => {
    // Pure rotation around X by 90°. Godot column-major basis for Rx(90°):
    //   basis_x = (1, 0, 0)
    //   basis_y = (0, 0, 1)
    //   basis_z = (0, -1, 0)
    // After decompose, Euler XYZ rotation.x should be ~π/2.
    const group = await renderAt({
      name: 'rot-x',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 0, z: 1 },
        basis_z: { x: 0, y: -1, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.rotation.x).toBeCloseTo(Math.PI / 2, 4);
  });

  it('#5 rotation.y decoded from basis (radians)', async () => {
    // Ry(90°): basis_x = (0, 0, -1), basis_y = (0, 1, 0), basis_z = (1, 0, 0).
    const group = await renderAt({
      name: 'rot-y',
      transform: {
        basis_x: { x: 0, y: 0, z: -1 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 1, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.rotation.y).toBeCloseTo(Math.PI / 2, 4);
  });

  it('#6 rotation.z decoded from basis (radians)', async () => {
    // Rz(90°): basis_x = (0, 1, 0), basis_y = (-1, 0, 0), basis_z = (0, 0, 1).
    const group = await renderAt({
      name: 'rot-z',
      transform: {
        basis_x: { x: 0, y: 1, z: 0 },
        basis_y: { x: -1, y: 0, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.rotation.z).toBeCloseTo(Math.PI / 2, 4);
  });

  it('#7 scale.x reflects basis column length', async () => {
    const group = await renderAt({
      name: 'scale-x',
      transform: {
        basis_x: { x: 2, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.scale.x).toBeCloseTo(2, 5);
  });

  it('#8 scale.y reflects basis column length', async () => {
    const group = await renderAt({
      name: 'scale-y',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 3, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.scale.y).toBeCloseTo(3, 5);
  });

  it('#9 scale.z reflects basis column length', async () => {
    const group = await renderAt({
      name: 'scale-z',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 0.5 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.scale.z).toBeCloseTo(0.5, 5);
  });

  it('#10 omitted transform → identity (pos 0,0,0; rot 0,0,0; scale 1,1,1)', async () => {
    const group = await renderAt({ name: 'no-transform' });
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
});
