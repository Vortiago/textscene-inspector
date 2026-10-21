import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AtlasAreaShadow } from './atlasAreaShadow';
import { holdPositionalShadowAtlas, positionalShadowAtlas } from './shadowAtlasTarget';

// The tests read the atlas at the root viewport's size.
holdPositionalShadowAtlas({}, 4096);

const slot = { x: 2048, y: 1024, size: 1024, paraboloidStep: null };

/** A 2×1 area light 3 units over the origin, facing down its own -Z, with a range of 6. */
function downwardArea(): THREE.RectAreaLight {
  const light = new THREE.RectAreaLight(0xffffff, 1, 2, 1);
  light.position.set(0, 3, 0);
  light.rotation.x = -Math.PI / 2;
  light.updateMatrixWorld();
  return light;
}

function areaShadow(): AtlasAreaShadow {
  const shadow = new AtlasAreaShadow();
  shadow.range = 6;
  shadow.size.set(2, 1);
  shadow.place(slot);
  return shadow;
}

/** A unit box centred on `position`, its world matrix current. */
function boxAt(x: number, y: number, z: number): THREE.Mesh {
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  box.position.set(x, y, z);
  box.updateMatrixWorld();
  return box;
}

describe('AtlasAreaShadow.place', () => {
  it('asks three for the atlas’s own size, with the slot as one viewport of it', () => {
    const shadow = areaShadow();
    expect(shadow.map).toBe(positionalShadowAtlas());
    expect(shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(shadow.getFrameExtents().toArray()).toEqual([4, 4]);
    expect(shadow.getViewport(0).toArray()).toEqual([2, 1, 1, 1]);
  });

  it('reads the opacity its light set only while it holds a slot (edge case)', () => {
    const shadow = areaShadow();
    shadow.intensity = 0.4;
    expect(shadow.intensity).toBe(0.4);
    shadow.place(null);
    expect(shadow.intensity).toBe(0);
  });

  it('is never drawn by three’s own pass (edge case)', () => {
    expect(areaShadow().autoUpdate).toBe(false);
  });
});

describe('AtlasAreaShadow.updateMatrices', () => {
  it('views from the light, down its own -Z', () => {
    const shadow = areaShadow();
    shadow.updateMatrices(downwardArea());
    const point = new THREE.Vector3(0, 0, 0).applyMatrix4(shadow.camera.matrixWorldInverse);
    expect(point.distanceTo(new THREE.Vector3(0, 0, -3))).toBeCloseTo(0, 12);
  });

  it('maps the distance from the light to the far plane onto the clip range', () => {
    const shadow = areaShadow();
    shadow.updateMatrices(downwardArea());
    const far = 6 + Math.hypot(2, 1) / 2;
    const clip = new THREE.Vector4(0, 0, far, 1).applyMatrix4(shadow.camera.projectionMatrix);
    expect(clip.z).toBeCloseTo(1, 12);
    expect(new THREE.Vector4(0, 0, 0, 1).applyMatrix4(shadow.camera.projectionMatrix).z).toBe(-1);
  });

  it('confines three’s clear to the slot', () => {
    const shadow = areaShadow();
    shadow.updateMatrices(downwardArea());
    expect(shadow.map!.scissor.toArray()).toEqual([2048, 1024, 1024, 1024]);
  });
});

describe('AtlasAreaShadow casters', () => {
  const casterTest = (box: THREE.Mesh) => {
    const shadow = areaShadow();
    shadow.updateMatrices(downwardArea());
    return box.intersectsFrustum(shadow.getFrustum());
  };

  it('takes a caster between the light and its range', () => {
    expect(casterTest(boxAt(0, 0, 0))).toBe(true);
  });

  it('leaves out a caster behind the light (edge case)', () => {
    expect(casterTest(boxAt(0, 4, 0))).toBe(false);
  });

  it('leaves out a caster past the range (edge case)', () => {
    expect(casterTest(boxAt(0, -4, 0))).toBe(false);
  });

  it('leaves out a caster beside the volume, which its bounding sphere would reach (edge case)', () => {
    // The box spans x from 6.6 to 7.6 against the volume's edge at 7, and z from 6.6 to 7.6
    // against 6.5: its sphere reaches the volume's corner, its box does not.
    expect(casterTest(boxAt(7.1, 0, 7.1))).toBe(false);
  });
});

describe('AtlasAreaShadow lookup', () => {
  it('maps a point in the view’s space into the light’s own space', () => {
    const view = new THREE.PerspectiveCamera();
    view.position.set(0, 0, 5);
    view.updateMatrixWorld();
    const matrix = areaShadow().viewToLookup(view, new THREE.Matrix4(), downwardArea());
    // The world origin lies 5 in front of the view, and 3 below the light, down its -Z.
    const point = new THREE.Vector3(0, 0, -5).applyMatrix4(matrix);
    expect(point.distanceTo(new THREE.Vector3(0, 0, -3))).toBeCloseTo(0, 12);
  });

  it('ignores the light’s scale, as its map does (edge case)', () => {
    const light = downwardArea();
    light.scale.set(2, 3, 4);
    light.updateMatrixWorld();
    const view = new THREE.PerspectiveCamera();
    view.updateMatrixWorld();
    const matrix = areaShadow().viewToLookup(view, new THREE.Matrix4(), light);
    const point = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix);
    expect(point.distanceTo(new THREE.Vector3(0, 0, -3))).toBeCloseTo(0, 12);
  });

  it('gives its slot as a rectangle in units of the atlas', () => {
    expect(areaShadow().slotRect(new THREE.Vector4())!.toArray()).toEqual([0.5, 0.25, 0.25, 0.25]);
  });

  it('gives no rectangle without a slot (error case)', () => {
    const shadow = areaShadow();
    shadow.place(null);
    expect(shadow.slotRect(new THREE.Vector4(1, 1, 1, 1))).toBeNull();
  });
});
