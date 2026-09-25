/**
 * Zoom-to-pointer: the point under the pointer stays under the pointer. The assertion
 * projects through a real `PerspectiveCamera`. The anchor helper restates the
 * focus-plane formula on purpose, so a wrong constant in production fails here.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cursorCameraPosition, cursorQuaternion, type EditorCursor } from './godotEditorCursor';
import { zoomCursorToPointer, type PointerView } from './zoomToPointer';

const RANGE = { near: 0.001, far: 100000 };
const VIEW: PointerView = { offsetX: 0, offsetY: 0, height: 800, fovDegrees: 70 };

function cursorAt(distance: number, target = new THREE.Vector3()): EditorCursor {
  return { target, xRot: 0.5, yRot: -0.5, distance };
}

/** Where a world point lands on screen, in pixels from the viewport centre: what the user sees. */
function project(cursor: EditorCursor, point: THREE.Vector3, view: PointerView) {
  const camera = new THREE.PerspectiveCamera(view.fovDegrees, 1, 0.01, 10000);
  camera.position.copy(cursorCameraPosition(cursor));
  camera.quaternion.copy(cursorQuaternion(cursor));
  camera.updateMatrixWorld();
  const ndc = point.clone().project(camera);
  return { x: (ndc.x * view.height) / 2, y: (-ndc.y * view.height) / 2 };
}

/** The world point currently under the pointer, on the focus plane. */
function pointUnderPointer(cursor: EditorCursor, view: PointerView): THREE.Vector3 {
  const basis = cursorQuaternion(cursor);
  const unitsPerPixel = (2 * Math.tan((view.fovDegrees * Math.PI) / 360) * cursor.distance) / view.height;
  return cursor.target
    .clone()
    .add(new THREE.Vector3(1, 0, 0).applyQuaternion(basis).multiplyScalar(view.offsetX * unitsPerPixel))
    .add(new THREE.Vector3(0, 1, 0).applyQuaternion(basis).multiplyScalar(-view.offsetY * unitsPerPixel));
}

describe('zoomCursorToPointer', () => {
  it('keeps the point under an off-centre pointer under it, zooming in', () => {
    const view = { ...VIEW, offsetX: 260, offsetY: -140 };
    const cursor = cursorAt(40);
    const anchor = pointUnderPointer(cursor, view);
    const before = project(cursor, anchor, view);

    const zoomed = zoomCursorToPointer(cursor, 1 / 1.08 ** 6, RANGE, view);

    expect(zoomed.distance).toBeLessThan(cursor.distance);
    const after = project(zoomed, anchor, view);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('keeps it under the pointer zooming out too', () => {
    const view = { ...VIEW, offsetX: -180, offsetY: 220 };
    const cursor = cursorAt(12, new THREE.Vector3(3, -1, 2));
    const anchor = pointUnderPointer(cursor, view);
    const before = project(cursor, anchor, view);

    const zoomed = zoomCursorToPointer(cursor, 1.08 ** 4, RANGE, view);

    expect(zoomed.distance).toBeGreaterThan(cursor.distance);
    const after = project(zoomed, anchor, view);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('leaves the focus point alone for a centred pointer — Godot’s behaviour', () => {
    const cursor = cursorAt(40, new THREE.Vector3(1, 2, 3));
    const zoomed = zoomCursorToPointer(cursor, 1 / 1.08 ** 3, RANGE, VIEW);
    expect(zoomed.target.distanceTo(cursor.target)).toBeLessThan(1e-12);
    expect(zoomed.distance).toBeLessThan(cursor.distance);
  });

  it('does not creep sideways once the zoom is clamped', () => {
    // The failure this guards: at the range floor the eye stops but the target
    // keeps sliding, so holding the wheel drifts the view off the subject.
    const view = { ...VIEW, offsetX: 300, offsetY: 200 };
    const tight = { near: 2.5, far: 100 };
    let cursor = cursorAt(10);
    for (let i = 0; i < 40; i++) cursor = zoomCursorToPointer(cursor, 1 / 1.08, tight, view);
    const atFloor = cursor;
    const further = zoomCursorToPointer(atFloor, 1 / 1.08, tight, view);

    expect(atFloor.distance).toBeCloseTo(10, 6); // floor is near*4 = 10
    expect(further.target.distanceTo(atFloor.target)).toBe(0);
    expect(further.distance).toBe(atFloor.distance);
  });

  it('survives a zero-height viewport rather than dividing by it', () => {
    const cursor = cursorAt(40);
    const zoomed = zoomCursorToPointer(cursor, 0.5, RANGE, { ...VIEW, offsetX: 100, height: 0 });
    expect(Number.isFinite(zoomed.target.x)).toBe(true);
    expect(zoomed.target.distanceTo(cursor.target)).toBe(0);
  });
});
