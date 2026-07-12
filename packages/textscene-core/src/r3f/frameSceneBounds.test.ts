/**
 * `frameSceneBounds`'s `tscnEmptyState`-tag exclusion (shared by
 * `EmptySceneIndicator` and the opt-in `ContentGroundGrid`, TscnCanvas.tsx).
 *
 * `THREE.Object3D.traverse()` always recurses into every descendant
 * regardless of what the visitor callback does for an ancestor, so a tag on
 * a WRAPPING group does not exclude that group's children — only a tag on
 * the object being visited itself is actually honored. This pins the fix:
 * the grid must be excluded when tagged directly, and a scene with only
 * small gizmo content plus a large tagged grid must frame around the real
 * content, not the grid.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { frameSceneBounds } from './frameSceneBounds';

/** Mirrors TscnCanvas.tsx's `GroundGrid()` — a large, framing-exempt grid. */
function taggedGrid(): THREE.GridHelper {
  const grid = new THREE.GridHelper(10, 10);
  grid.userData = { tscnEmptyState: true };
  return grid;
}

function makeCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
}

describe('frameSceneBounds — tscnEmptyState exclusion', () => {
  it('a tagged grid alone (no other content) yields no bounds to frame (no-op)', () => {
    const scene = new THREE.Scene();
    scene.add(taggedGrid());
    const camera = makeCamera();
    const startPos = camera.position.clone();

    frameSceneBounds(scene, camera, null);

    // Nothing frameable -> frameSceneBounds is a no-op, camera unmoved.
    expect(camera.position.equals(startPos)).toBe(true);
  });

  it('frames around small untagged gizmo content, ignoring a large tagged grid in the same scene', () => {
    const scene = new THREE.Scene();
    scene.add(taggedGrid()); // 10x10 units, must be excluded

    // Tiny real content: a tiny line segment near the origin (a gizmo-only
    // scene shape, e.g. a lone Path3D with no Mesh).
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, 0.1, 0.1),
    ]);
    const tinyGizmo = new THREE.Line(geometry, new THREE.LineBasicMaterial());
    scene.add(tinyGizmo);

    const camera = makeCamera();
    frameSceneBounds(scene, camera, null);

    // If the grid's 10-unit extent had leaked into the bounds, the camera
    // would sit ~8-9+ units away (per the isometric 1.6x-distance framing of
    // a 10-unit maxDim). Framing the real ~0.17-unit content instead keeps
    // the camera very close.
    expect(camera.position.length()).toBeLessThan(1);
  });

  it('frames around the full 10-unit grid when it is the ONLY (untagged) content', () => {
    // Sanity check: an ordinary, non-exempt LineSegments-based gizmo of the
    // same size as the grid IS framed normally — the exclusion is specific
    // to the tscnEmptyState tag, not to grids/LineSegments in general.
    const scene = new THREE.Scene();
    const untaggedGrid = new THREE.GridHelper(10, 10);
    scene.add(untaggedGrid);

    const camera = makeCamera();
    frameSceneBounds(scene, camera, null);

    expect(camera.position.length()).toBeGreaterThan(5);
  });
});
