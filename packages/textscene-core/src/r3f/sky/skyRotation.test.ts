import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { skyEuler, worldToSky } from './skyRotation';

describe('skyEuler', () => {
  it("composes Y, X then Z, as Godot's Basis::from_euler does", () => {
    const euler = skyEuler({ x: 0.1, y: 0.2, z: 0.3 });

    expect(euler.order).toBe('YXZ');
    expect(euler.toArray().slice(0, 3)).toEqual([0.1, 0.2, 0.3]);
  });
});

describe('worldToSky', () => {
  it('is the identity for no rotation', () => {
    expect(worldToSky(new THREE.Euler(), new THREE.Matrix3()).equals(new THREE.Matrix3())).toBe(true);
  });

  it('turns a world direction back by the sky rotation', () => {
    // A sky turned a quarter about +Y shows its +Z where the world's +X is.
    const toSky = worldToSky(skyEuler({ x: 0, y: Math.PI / 2, z: 0 }), new THREE.Matrix3());
    const skyDirection = new THREE.Vector3(1, 0, 0).applyMatrix3(toSky);

    expect(skyDirection.x).toBeCloseTo(0, 6);
    expect(skyDirection.z).toBeCloseTo(1, 6);
  });

  it('undoes skyEuler for any rotation (edge case)', () => {
    const rotation = { x: 0.4, y: -1.1, z: 2.3 };
    const turned = new THREE.Vector3(0.2, 0.5, -0.8).applyEuler(skyEuler(rotation));

    const back = turned.applyMatrix3(worldToSky(skyEuler(rotation), new THREE.Matrix3()));
    expect(back.x).toBeCloseTo(0.2, 6);
    expect(back.y).toBeCloseTo(0.5, 6);
    expect(back.z).toBeCloseTo(-0.8, 6);
  });
});
