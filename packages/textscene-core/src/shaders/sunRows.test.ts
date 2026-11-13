import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lightSizeDeclaration, lightSpecularDeclaration } from './lights/lightDeclarations.js';
import { SPLIT_SLOTS, SUN_ROW, SUN_ROWS, writeSunRows, type SplitShadowLayout } from './sunRows.js';

/** The rows one write pass leaves, as `LightRows` would upload them. */
function writtenRows(light: THREE.Light, camera: THREE.Camera | null, softShadows = false): THREE.Vector4[] {
  const rows = Array.from({ length: SUN_ROWS }, () => new THREE.Vector4());
  writeSunRows((field, x, y, z, w) => rows[field]!.set(x, y, z, w), light, camera, softShadows);
  return rows;
}

function sunAt(position: THREE.Vector3): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(new THREE.Color(1, 0.5, 0.25), 2);
  light.position.copy(position);
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  return light;
}

/** A split layout with recognisable values in each slot. */
function splitLayout(): SplitShadowLayout {
  return {
    _cascadeData: Array.from(
      { length: SPLIT_SLOTS },
      (_, slot) => new THREE.Vector4(slot + 1, 0.01, 0.02, -1e30)
    ),
    rangeBegins: new THREE.Vector4(1, 2, 3, 4),
    fade: { from: 10, to: 12 },
    softShadowAngle: 0.05,
    getMatrix: (slot) => new THREE.Matrix4().makeTranslation(slot, 0, 0),
    mapSize: new THREE.Vector2(512, 512),
    getFrameExtents: () => new THREE.Vector2(2, 2),
    intensity: 0.75,
    radius: 1.5,
  };
}

/** A light that shades with a split layout for its parent, as the renderer's split sun does. */
class SplitStandIn extends THREE.Light {
  readonly shadow = splitLayout() as unknown as THREE.LightShadow;

  get declaredLight(): THREE.Object3D | null {
    return this.parent;
  }
}

describe('writeSunRows', () => {
  it('writes the colour times the energy, and three’s full specular for an undeclared light', () => {
    const rows = writtenRows(sunAt(new THREE.Vector3(0, 1, 0)), null);

    expect(rows[SUN_ROW.colour]!.toArray()).toEqual([2, 1, 0.5, 1]);
  });

  it('writes the declared specular amount', () => {
    const light = sunAt(new THREE.Vector3(0, 1, 0));
    light.userData = lightSpecularDeclaration.userData({ amount: 0.25 });

    expect(writtenRows(light, null)[SUN_ROW.colour]!.w).toBe(0.25);
  });

  it('points from the target towards the light, in the camera’s view space', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.y = Math.PI / 2;
    camera.updateMatrixWorld();
    const rows = writtenRows(sunAt(new THREE.Vector3(3, 0, 0)), camera);

    const [x, y, z] = rows[SUN_ROW.direction]!.toArray();
    expect([x, y, z].map((value) => Math.round(value * 1e6) / 1e6)).toEqual([0, 0, 1]);
    expect(rows[SUN_ROW.worldDirection]!.toArray().slice(0, 3)).toEqual([1, 0, 0]);
  });

  it('gives the light its size only while the render draws directional soft shadows', () => {
    const light = sunAt(new THREE.Vector3(0, 1, 0));
    light.userData = lightSizeDeclaration.userData({ size: 0.01 });

    expect(writtenRows(light, null, false)[SUN_ROW.direction]!.w).toBe(0);
    expect(writtenRows(light, null, true)[SUN_ROW.direction]!.w).toBe(0.01);
  });

  it('reads the declarations of the light a stand-in shades for', () => {
    const declared = sunAt(new THREE.Vector3(0, 1, 0));
    declared.userData = lightSpecularDeclaration.userData({ amount: 0.5 });
    const standIn = new SplitStandIn();
    declared.add(standIn);

    expect(writtenRows(standIn, null)[SUN_ROW.colour]!.w).toBe(0.5);
  });

  it('writes each slot of a split layout', () => {
    const declared = sunAt(new THREE.Vector3(0, 1, 0));
    const standIn = new SplitStandIn();
    declared.add(standIn);
    const rows = writtenRows(standIn, null);

    expect(rows[SUN_ROW.splits + 2]!.toArray()).toEqual([3, 0.01, 0.02, -1e30]);
    expect(rows[SUN_ROW.matrices + 2 * 3]!.toArray()).toEqual([1, 0, 0, 2]);
    expect(rows[SUN_ROW.shadow]!.toArray()).toEqual([10, 12, 0.75, 1.5]);
    expect(rows[SUN_ROW.atlas]!.toArray()).toEqual([1024, 1024, 0.05, 0]);
    expect(rows[SUN_ROW.rangeBegins]!.toArray()).toEqual([1, 2, 3, 4]);
  });
});
