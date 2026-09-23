/**
 * The three ceiling_lamp instances declare `parent="RoomGeometry"`, so RoomGeometry's
 * near-identity offset composes on top of each lamp origin. In ceiling_lamp.tscn the glb root and
 * OmniLight3D are identity, and the plafoniera's uniform scale (0.18924935) does not move the
 * origin. Every basis is a pure translation, taken from a real hallway scene.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseTransform3D, decomposeTransform3D } from './transform';

const ROOM_GEOM =
  'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -0.0010881424, 0.0035161972, 0.0035357475)';
const RG_O = { x: -0.0010881424, y: 0.0035161972, z: 0.0035357475 };
const IDENTITY = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';

interface Lamp {
  name: string;
  transform: string;
  // Godot-correct expected world origin = RoomGeometry.origin + lamp.origin.
  expected: { x: number; y: number; z: number };
}

const LAMPS: Lamp[] = [
  {
    name: 'ceiling_lamp',
    transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 8.803779, 4, 0)',
    expected: { x: 8.803779 + RG_O.x, y: 4 + RG_O.y, z: 0 + RG_O.z },
  },
  {
    name: 'ceiling_lamp3',
    transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2.14916, 4, 0)',
    expected: { x: -2.14916 + RG_O.x, y: 4 + RG_O.y, z: 0 + RG_O.z },
  },
  {
    name: 'ceiling_lamp5',
    transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 9, 4, 5.594346)',
    expected: { x: 9 + RG_O.x, y: 4 + RG_O.y, z: 5.594346 + RG_O.z },
  },
];

/** Local matrix for a Transform3D string (what R3F's <group> produces). */
function matrixFor(transformString: string): THREE.Matrix4 {
  const d = decomposeTransform3D(parseTransform3D(transformString));
  const o = new THREE.Object3D();
  o.position.set(d.position.x, d.position.y, d.position.z);
  o.rotation.set(d.rotation.x, d.rotation.y, d.rotation.z);
  o.scale.set(d.scale.x, d.scale.y, d.scale.z);
  o.updateMatrix();
  return o.matrix.clone();
}

describe('ceiling-lamp nested-instance composition — regression suite', () => {
  const rgWorld = matrixFor(ROOM_GEOM);

  it.each(LAMPS)(
    '$name OmniLight3D / glb-root world = RoomGeometry.origin + lamp.origin',
    ({ transform, expected }) => {
      // worldM = RoomGeometry * lamp * identityChild (OmniLight3D / glb root).
      const worldM = rgWorld.clone().multiply(matrixFor(transform)).multiply(matrixFor(IDENTITY));
      const pos = new THREE.Vector3().setFromMatrixPosition(worldM);
      expect(pos.x).toBeCloseTo(expected.x, 5);
      expect(pos.y).toBeCloseTo(expected.y, 5);
      expect(pos.z).toBeCloseTo(expected.z, 5);
    }
  );

  it('plafoniera (uniform scale 0.18924935) sits at the lamp origin and keeps its scale', () => {
    const plafoniera =
      'Transform3D(0.18924935, 0, 0, 0, 0.18924935, 0, 0, 0, 0.18924935, 0, 0, 0)';
    const worldM = rgWorld.clone().multiply(matrixFor(LAMPS[0]!.transform)).multiply(matrixFor(plafoniera));

    const pos = new THREE.Vector3().setFromMatrixPosition(worldM);
    expect(pos.x).toBeCloseTo(LAMPS[0]!.expected.x, 5);
    expect(pos.y).toBeCloseTo(LAMPS[0]!.expected.y, 5);
    expect(pos.z).toBeCloseTo(LAMPS[0]!.expected.z, 5);

    const scale = new THREE.Vector3();
    worldM.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    expect(scale.x).toBeCloseTo(0.18924935, 5);
    expect(scale.y).toBeCloseTo(0.18924935, 5);
    expect(scale.z).toBeCloseTo(0.18924935, 5);
  });

  it('each lamp Transform3D decomposes to identity rotation/scale + its local origin', () => {
    for (const { transform } of LAMPS) {
      const d = decomposeTransform3D(parseTransform3D(transform));
      expect(d.rotation.x).toBeCloseTo(0, 6);
      expect(d.rotation.y).toBeCloseTo(0, 6);
      expect(d.rotation.z).toBeCloseTo(0, 6);
      expect(d.scale.x).toBeCloseTo(1, 6);
      expect(d.scale.y).toBeCloseTo(1, 6);
      expect(d.scale.z).toBeCloseTo(1, 6);
    }
  });
});
