/**
 * `frameSceneBounds` — which objects reach the bounds union, and from which
 * direction it then frames them.
 *
 * The `tscnEmptyState`-tag exclusion (shared by `EmptySceneIndicator` and the
 * opt-in `ContentGroundGrid`, TscnCanvas.tsx) is the first of them.
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
import { editorCameraDirection } from './godotEditorCamera';

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

describe('frameSceneBounds — dimensionally flat scenes use Godot\'s own editor orbit', () => {
  it('a scene whose geometry is entirely coplanar (z spread 0) still frames from editorCameraDirection(), not head-on', () => {
    // A quad lying flat in the XY plane — genuinely z-flat, the exact shape
    // that used to trip frameSceneBounds's now-removed isFlat branch (head-on
    // dir (0,0,1), a picture Godot's own reference camera never produces: its
    // editor orbit is fixed regardless of scene flatness).
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const scene = new THREE.Scene();
    scene.add(mesh);

    const camera = makeCamera();
    frameSceneBounds(scene, camera, null);

    // The camera must sit along the SAME direction from the origin (the
    // plane's centre) as Godot's fixed editor orbit — never straight down -Z.
    const actualDir = camera.position.clone().normalize();
    const expectedDir = editorCameraDirection();
    expect(actualDir.dot(expectedDir)).toBeGreaterThan(0.999);
  });
});

describe('frameSceneBounds — a bounds union with no extent', () => {
  /** A node Godot never sized: the zero-size proxy CSG and Label3D both mount. */
  function pointProxy(x: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0, 0, 0), new THREE.MeshBasicMaterial());
    mesh.visible = false;
    mesh.position.x = x;
    mesh.userData = { tscnBoundsProxy: true };
    return mesh;
  }

  it('does not let a point mesh defeat the gizmo fallback', () => {
    // A point is not a mesh to frame FROM, so the light-only fallback still applies —
    // otherwise a scene whose only CSG content is invisible frames nothing at all.
    const scene = new THREE.Scene();
    scene.add(pointProxy(0));
    const gizmo = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(3, 3, 3),
        new THREE.Vector3(5, 5, 5),
      ])
    );
    scene.add(gizmo);

    const controls = { target: new THREE.Vector3(), update: () => {} };
    frameSceneBounds(scene, makeCamera(), controls);

    expect(controls.target.x).toBeCloseTo(4, 5);
    expect(controls.target.y).toBeCloseTo(4, 5);
  });

  it('re-points a point-only scene instead of leaving the camera where it was', () => {
    // Node3DEditorViewport::focus_selection moves the orbit cursor onto the centre and
    // keeps its distance; there is no size here to derive a new one from.
    const scene = new THREE.Scene();
    scene.add(pointProxy(8));

    const camera = makeCamera();
    camera.position.set(0, 0, 10);
    const controls = { target: new THREE.Vector3(), update: () => {} };
    frameSceneBounds(scene, camera, controls);

    expect(controls.target.x).toBeCloseTo(8, 5);
    expect(camera.position.toArray()).toEqual([8, 0, 10]);
  });
});

describe('frameSceneBounds — CSG contributor bounds proxies', () => {
  it('frames a contributor solid the boolean subtracted away', () => {
    // modules/csg/csg_shape.cpp:507 — every shape's node_aabb is its OWN brush,
    // filled in by the root's recursive build, so the subtracted solid is inside
    // Godot's scene AABB too. Skipping the proxy frames a smaller, different box.
    const scene = new THREE.Scene();
    const result = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.4), new THREE.MeshBasicMaterial());
    scene.add(result);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 2), new THREE.MeshBasicMaterial());
    proxy.visible = false;
    proxy.position.z = 1;
    proxy.userData = { tscnBoundsProxy: true };
    scene.add(proxy);

    const controls = { target: new THREE.Vector3(), update: () => {} };
    frameSceneBounds(scene, makeCamera(), controls);

    // z spans -0.2..2 with the contributor.
    expect(controls.target.z).toBeCloseTo(0.9, 5);

    // The counterfactual: without the proxy the same scene frames -0.2..0.2.
    scene.remove(proxy);
    const without = { target: new THREE.Vector3(), update: () => {} };
    frameSceneBounds(scene, makeCamera(), without);
    expect(without.target.z).toBeCloseTo(0, 5);
  });
});
