/**
 * Negative-scale decomposition through the actual <Node3D> render path.
 * `utils/transform.threeEquivalence.test.ts` already bit-pins
 * `decomposeTransform3D` against a three.js oracle at the pure-math layer
 * (including a `diag(-1,1,1)` reflection case) — this file instead exercises
 * the WIRING: does <Node3D> apply the decomposed reflection to a real
 * THREE.Group the same way. Round-trip assertions (recompose → compare to
 * the original basis) avoid hand-derived rotation numbers for the
 * full-inversion / rotation-combined cases, where the decomposition folds
 * the reflection sign into scale.x and finds a compensating rotation that
 * is not obvious to hand-calculate.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node3D } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { Node3DProperties, Transform3D } from './types';

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
  return renderer.scene.findByProps({ name: node.name }).instance as THREE.Group;
}

/** Godot Basis is `Vector3 rows[3]` — recover rows from a THREE.Matrix4's column-major elements. */
function godotRowsFromMatrix(m: THREE.Matrix4): Transform3D {
  const te = m.elements;
  return {
    basis_x: { x: te[0]!, y: te[4]!, z: te[8]! },
    basis_y: { x: te[1]!, y: te[5]!, z: te[9]! },
    basis_z: { x: te[2]!, y: te[6]!, z: te[10]! },
    origin: { x: te[12]!, y: te[13]!, z: te[14]! },
  };
}

describe('Node3D negative-scale decomposition', () => {
  it('negative-X basis decomposes to scale.x=-1 with identity rotation', async () => {
    const group = await renderAt({
      name: 'neg-x',
      transform: {
        basis_x: { x: -1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
    });
    expect(group.scale.x).toBeCloseTo(-1, 5);
    expect(group.scale.y).toBeCloseTo(1, 5);
    expect(group.scale.z).toBeCloseTo(1, 5);
    expect(group.rotation.x).toBeCloseTo(0, 5);
    expect(group.rotation.y).toBeCloseTo(0, 5);
    expect(group.rotation.z).toBeCloseTo(0, 5);
  });

  it('negative-XYZ (full inversion) folds the sign into scale.x and finds a compensating rotation', async () => {
    const transform: Transform3D = {
      basis_x: { x: -1, y: 0, z: 0 },
      basis_y: { x: 0, y: -1, z: 0 },
      basis_z: { x: 0, y: 0, z: -1 },
      origin: { x: 2, y: 3, z: -4 },
    };
    const group = await renderAt({ name: 'neg-xyz', transform });

    // Convention (utils/transform.ts doc comment): a negative determinant
    // folds ALL of its sign into scale.x — y/z stay positive.
    expect(group.scale.x).toBeLessThan(0);
    expect(group.scale.y).toBeGreaterThan(0);
    expect(group.scale.z).toBeGreaterThan(0);

    // Round-trip: recompose the rendered TRS into a matrix and confirm it
    // reproduces the ORIGINAL basis — the property that actually matters,
    // independent of which specific rotation the algorithm picked.
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(group.rotation.x, group.rotation.y, group.rotation.z, 'XYZ')
    );
    const recomposed = new THREE.Matrix4().compose(
      new THREE.Vector3(group.position.x, group.position.y, group.position.z),
      quat,
      new THREE.Vector3(group.scale.x, group.scale.y, group.scale.z)
    );
    const rows = godotRowsFromMatrix(recomposed);
    expect(rows.basis_x.x).toBeCloseTo(transform.basis_x.x, 4);
    expect(rows.basis_x.y).toBeCloseTo(transform.basis_x.y, 4);
    expect(rows.basis_x.z).toBeCloseTo(transform.basis_x.z, 4);
    expect(rows.basis_y.x).toBeCloseTo(transform.basis_y.x, 4);
    expect(rows.basis_y.y).toBeCloseTo(transform.basis_y.y, 4);
    expect(rows.basis_y.z).toBeCloseTo(transform.basis_y.z, 4);
    expect(rows.basis_z.x).toBeCloseTo(transform.basis_z.x, 4);
    expect(rows.basis_z.y).toBeCloseTo(transform.basis_z.y, 4);
    expect(rows.basis_z.z).toBeCloseTo(transform.basis_z.z, 4);
    expect(rows.origin.x).toBeCloseTo(transform.origin.x, 4);
    expect(rows.origin.y).toBeCloseTo(transform.origin.y, 4);
    expect(rows.origin.z).toBeCloseTo(transform.origin.z, 4);
  });

  it('negative scale combined with rotation round-trips to the same world transform', async () => {
    // Build a known-good basis via THREE (Ry(90°)-ish rotation + a
    // negative-X, non-uniform scale), convert to Godot row storage, then
    // feed it through the actual Node3D render path.
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, Math.PI / 2, -0.2, 'XYZ'));
    const scale = new THREE.Vector3(-2, 3, 4);
    const position = new THREE.Vector3(1, -2, 5);
    const composed = new THREE.Matrix4().compose(position, quat, scale);
    const transform = godotRowsFromMatrix(composed);

    const group = await renderAt({ name: 'neg-scale-rot', transform });

    const recomposedQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(group.rotation.x, group.rotation.y, group.rotation.z, 'XYZ')
    );
    const recomposed = new THREE.Matrix4().compose(
      new THREE.Vector3(group.position.x, group.position.y, group.position.z),
      recomposedQuat,
      new THREE.Vector3(group.scale.x, group.scale.y, group.scale.z)
    );

    for (let i = 0; i < 16; i++) {
      expect(recomposed.elements[i]!).toBeCloseTo(composed.elements[i]!, 4);
    }
  });
});
