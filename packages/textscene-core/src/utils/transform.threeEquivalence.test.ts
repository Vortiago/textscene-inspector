/**
 * Bit-equivalence guard for the dependency-free decomposeTransform3D.
 *
 * The pure-math implementation replicates three.js r184's decomposition
 * path op-for-op; this suite pins that claim by running the RETIRED
 * three.js-backed implementation (reproduced verbatim below as the oracle)
 * against the new one and asserting Object.is-equality per component —
 * including ±0 and branch-sensitive gimbal cases. Importing three here is
 * fine: tests are excluded from every import-closure guard walk
 * (reactFree.test.ts, webExtensionSafe.test.ts).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Transform3D, DecomposedTransform } from '../nodes/base/node3d/types';
import { decomposeTransform3D } from './transform';

/** The pre-replacement implementation, verbatim — the reference oracle. */
function decomposeWithThree(transform: Transform3D): DecomposedTransform {
  const { basis_x, basis_y, basis_z, origin } = transform;
  const m = new THREE.Matrix4().set(
    basis_x.x, basis_x.y, basis_x.z, origin.x,
    basis_y.x, basis_y.y, basis_y.z, origin.y,
    basis_z.x, basis_z.y, basis_z.z, origin.z,
    0, 0, 0, 1
  );

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  m.decompose(pos, quat, sc);

  const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');

  return {
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
    scale: { x: sc.x, y: sc.y, z: sc.z },
  };
}

/** Deterministic PRNG so fuzz failures are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert a composed THREE matrix into Godot row-vector storage. */
function godotRowsFromMatrix(m: THREE.Matrix4): Transform3D {
  const te = m.elements;
  return {
    basis_x: { x: te[0]!, y: te[4]!, z: te[8]! },
    basis_y: { x: te[1]!, y: te[5]!, z: te[9]! },
    basis_z: { x: te[2]!, y: te[6]!, z: te[10]! },
    origin: { x: te[12]!, y: te[13]!, z: te[14]! },
  };
}

/** Mimic Godot's float32 serialization of every component. */
function froundTransform(t: Transform3D): Transform3D {
  const f = (v: { x: number; y: number; z: number }) => ({
    x: Math.fround(v.x),
    y: Math.fround(v.y),
    z: Math.fround(v.z),
  });
  return {
    basis_x: f(t.basis_x),
    basis_y: f(t.basis_y),
    basis_z: f(t.basis_z),
    origin: f(t.origin),
  };
}

/**
 * Object.is comparison per component (bit-exact: distinguishes ±0, accepts
 * NaN === NaN). Returns a list of human-readable mismatches.
 */
function bitDiff(
  label: string,
  actual: DecomposedTransform,
  expected: DecomposedTransform
): string[] {
  const diffs: string[] = [];
  for (const section of ['position', 'rotation', 'scale'] as const) {
    for (const axis of ['x', 'y', 'z'] as const) {
      const a = actual[section][axis];
      const e = expected[section][axis];
      if (!Object.is(a, e)) {
        diffs.push(`${label} ${section}.${axis}: got ${a}, oracle ${e}`);
      }
    }
  }
  return diffs;
}

function expectBitEqual(label: string, t: Transform3D): void {
  expect(bitDiff(label, decomposeTransform3D(t), decomposeWithThree(t))).toEqual([]);
}

describe('decomposeTransform3D — bit-equivalence with the three.js oracle', () => {
  it('matches across 1000 seeded random TRS compositions (incl. reflections and float32 inputs)', () => {
    const rand = mulberry32(0xc0ffee);
    const failures: string[] = [];

    for (let i = 0; i < 1000; i++) {
      const euler = new THREE.Euler(
        (rand() * 2 - 1) * Math.PI,
        (rand() * 2 - 1) * Math.PI,
        (rand() * 2 - 1) * Math.PI,
        'XYZ'
      );
      const quat = new THREE.Quaternion().setFromEuler(euler);
      const scale = new THREE.Vector3(
        0.05 + rand() * 19.95,
        0.05 + rand() * 19.95,
        0.05 + rand() * 19.95
      );
      if (rand() < 0.25) {
        const axis = Math.floor(rand() * 3);
        if (axis === 0) scale.x = -scale.x;
        else if (axis === 1) scale.y = -scale.y;
        else scale.z = -scale.z;
      }
      const position = new THREE.Vector3(
        (rand() * 2 - 1) * 100,
        (rand() * 2 - 1) * 100,
        (rand() * 2 - 1) * 100
      );

      const m = new THREE.Matrix4().compose(position, quat, scale);
      let t = godotRowsFromMatrix(m);
      if (i % 2 === 0) t = froundTransform(t);

      failures.push(...bitDiff(`iter ${i}`, decomposeTransform3D(t), decomposeWithThree(t)));
    }

    expect(failures).toEqual([]);
  });

  it('matches on identity', () => {
    expectBitEqual('identity', {
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 0, y: 0, z: 0 },
    });
  });

  it('matches on pure translation', () => {
    expectBitEqual('translation', {
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 12.5, y: -3.25, z: 0.0625 },
    });
  });

  it('matches on a degenerate basis (zero column → det === 0 identity branch)', () => {
    expectBitEqual('zero column', {
      basis_x: { x: 0, y: 0, z: 0.5 },
      basis_y: { x: 0, y: 2, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 1, y: 2, z: 3 },
    });
  });

  it('matches on an all-zero basis', () => {
    expectBitEqual('all-zero basis', {
      basis_x: { x: 0, y: 0, z: 0 },
      basis_y: { x: 0, y: 0, z: 0 },
      basis_z: { x: 0, y: 0, z: 0 },
      origin: { x: -7, y: 8, z: 9 },
    });
  });

  it('matches on a pure reflection diag(-1, 1, 1)', () => {
    expectBitEqual('reflection', {
      basis_x: { x: -1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 0, y: 0, z: 0 },
    });
  });

  it('matches on near-gimbal rotations straddling the 0.9999999 branch threshold', () => {
    for (const sign of [1, -1]) {
      for (const offset of [-1e-9, 0, 1e-9]) {
        const target = sign * (0.9999999 + offset);
        const quat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0.3, Math.asin(Math.max(-1, Math.min(1, target))), -0.2, 'XYZ')
        );
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(1, 2, 3),
          quat,
          new THREE.Vector3(1, 1, 1)
        );
        expectBitEqual(`gimbal ${target}`, godotRowsFromMatrix(m));
      }
    }
  });

  it('matches on exact ±90° Y rotation (deep inside the gimbal branch)', () => {
    for (const sign of [1, -1]) {
      const quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.7, (sign * Math.PI) / 2, 1.1, 'XYZ')
      );
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(0, 0, 0),
        quat,
        new THREE.Vector3(2, 3, 4)
      );
      expectBitEqual(`±90°Y ${sign}`, godotRowsFromMatrix(m));
    }
  });

  it('matches on a tiny but non-degenerate scale (no near-zero guard — identical propagation)', () => {
    expectBitEqual('tiny scale', {
      basis_x: { x: 1e-20, y: 0, z: 0 },
      basis_y: { x: 0, y: 1e-20, z: 0 },
      basis_z: { x: 0, y: 0, z: 1e-20 },
      origin: { x: 0, y: 0, z: 0 },
    });
  });

  it('matches on a float32-serialized Godot-style basis (ShortWall shape)', () => {
    expectBitEqual('float32 basis', {
      basis_x: { x: Math.fround(-4.371139e-8), y: 0, z: Math.fround(0.25) },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: Math.fround(-1), y: 0, z: Math.fround(-1.7484556e-7) },
      origin: { x: 4, y: 1.5, z: 0 },
    });
  });
});
