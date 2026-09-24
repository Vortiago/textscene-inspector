/**
 * The WestInnerWindow frame from a real hallway scene: four inline bars and a glass pane under a
 * Node3D chain with a 180° flip about X. The four bars must be coplanar (world z = -1.758305664,
 * 0.0317 in front of the glass) and straddle the glass centre (3.5, 1.602) in X and Y.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseTransform3D, decomposeTransform3D } from './transform';

/** parentWorld * local(transformString), the way R3F composes nested groups. */
function composeChild(parentWorld: THREE.Matrix4, transformString: string): THREE.Matrix4 {
  const d = decomposeTransform3D(parseTransform3D(transformString));
  const o = new THREE.Object3D();
  o.position.set(d.position.x, d.position.y, d.position.z);
  o.rotation.set(d.rotation.x, d.rotation.y, d.rotation.z);
  o.scale.set(d.scale.x, d.scale.y, d.scale.z);
  o.updateMatrix();
  return parentWorld.clone().multiply(o.matrix);
}

function worldCenter(m: THREE.Matrix4): { x: number; y: number; z: number } {
  const v = new THREE.Vector3().setFromMatrixPosition(m);
  return { x: v.x, y: v.y, z: v.z };
}

describe('window-frame composition (WestInnerWindow) — regression suite', () => {
  const FRAME_PLANE_Z = -1.758305664;
  const IDENTITY = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';
  const WEST_INNER =
    'Transform3D(1, -8.742278e-08, 8.742278e-08, -8.742278e-08, -1, 0, 8.742278e-08, -7.642742e-15, -1, 3.5, 1.602, -1.87)';

  const childTransforms = {
    glass: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -0.08)',
    frameTop: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.5250001, -0.111694336)',
    frameBottom: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.525, -0.111694336)',
    frameLeft: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -0.375, 0, -0.111694336)',
    frameRight: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.37499952, 0, -0.111694336)',
  };

  function buildWorldCenters() {
    // SceneObjects + Windows are identity (no transform key in the tscn).
    const windows = composeChild(new THREE.Matrix4(), IDENTITY);
    const inner = composeChild(windows, WEST_INNER);
    return {
      glass: worldCenter(composeChild(inner, childTransforms.glass)),
      frameTop: worldCenter(composeChild(inner, childTransforms.frameTop)),
      frameBottom: worldCenter(composeChild(inner, childTransforms.frameBottom)),
      frameLeft: worldCenter(composeChild(inner, childTransforms.frameLeft)),
      frameRight: worldCenter(composeChild(inner, childTransforms.frameRight)),
    };
  }

  it('glass center matches Godot ground truth (3.5, 1.602, -1.79)', () => {
    const { glass } = buildWorldCenters();
    expect(glass.x).toBeCloseTo(3.5, 5);
    expect(glass.y).toBeCloseTo(1.602, 5);
    expect(glass.z).toBeCloseTo(-1.79, 5);
  });

  it('frame bar centers match Godot ground truth', () => {
    const { frameTop, frameBottom, frameLeft, frameRight } = buildWorldCenters();
    expect(frameTop.x).toBeCloseTo(3.5, 5);
    expect(frameTop.y).toBeCloseTo(1.0769999, 5);
    expect(frameTop.z).toBeCloseTo(FRAME_PLANE_Z, 5);
    expect(frameBottom.x).toBeCloseTo(3.5, 5);
    expect(frameBottom.y).toBeCloseTo(2.127, 5);
    expect(frameBottom.z).toBeCloseTo(FRAME_PLANE_Z, 5);
    expect(frameLeft.x).toBeCloseTo(3.125, 5);
    expect(frameLeft.y).toBeCloseTo(1.602, 5);
    expect(frameLeft.z).toBeCloseTo(FRAME_PLANE_Z, 5);
    expect(frameRight.x).toBeCloseTo(3.87499952, 5);
    expect(frameRight.y).toBeCloseTo(1.602, 5);
    expect(frameRight.z).toBeCloseTo(FRAME_PLANE_Z, 5);
  });

  it('the 4 frame bars are coplanar (share world Z)', () => {
    const c = buildWorldCenters();
    expect(c.frameTop.z).toBeCloseTo(FRAME_PLANE_Z, 5);
    expect(c.frameBottom.z).toBeCloseTo(FRAME_PLANE_Z, 5);
    expect(c.frameLeft.z).toBeCloseTo(FRAME_PLANE_Z, 5);
    expect(c.frameRight.z).toBeCloseTo(FRAME_PLANE_Z, 5);
  });

  it('frames form a rectangle straddling the glass center in X and Y', () => {
    const c = buildWorldCenters();
    // Left/Right straddle glass X and share glass Y (vertical bars).
    expect(c.frameLeft.x).toBeLessThan(c.glass.x);
    expect(c.frameRight.x).toBeGreaterThan(c.glass.x);
    expect(c.frameLeft.y).toBeCloseTo(c.glass.y, 5);
    expect(c.frameRight.y).toBeCloseTo(c.glass.y, 5);
    // Top/Bottom straddle glass Y and share glass X (horizontal bars).
    const minY = Math.min(c.frameTop.y, c.frameBottom.y);
    const maxY = Math.max(c.frameTop.y, c.frameBottom.y);
    expect(minY).toBeLessThan(c.glass.y);
    expect(maxY).toBeGreaterThan(c.glass.y);
    expect(c.frameTop.x).toBeCloseTo(c.glass.x, 5);
    expect(c.frameBottom.x).toBeCloseTo(c.glass.x, 5);

    // Bar centres 0.75 apart in X and 1.05 apart in Y enclose the 0.7 x 1.0 glass.
    expect(Math.abs(c.frameLeft.x - c.frameRight.x)).toBeCloseTo(0.74999952, 5);
    expect(Math.abs(c.frameTop.y - c.frameBottom.y)).toBeCloseTo(1.0500001, 5);
  });
});
