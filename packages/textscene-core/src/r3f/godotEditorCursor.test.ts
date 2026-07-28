/**
 * Navigation maths, pinned against Godot's own editor behaviour: the cursor
 * model round-trips with the editor's opening pose, the pole clamp holds, pan
 * carries eye and focus together, zoom never crosses the focus point, freelook
 * pivots on the eye, and each numpad snap looks down the axis Godot's
 * `_menu_option` picks.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  EDITOR_CAMERA_DISTANCE,
  EDITOR_CAMERA_FOV,
  EDITOR_CAMERA_X_ROT,
  EDITOR_CAMERA_Y_ROT,
  editorCameraPosition,
} from './godotEditorCamera';
import {
  FREELOOK_BASE_SPEED,
  FREELOOK_SPRINT_MULTIPLIER,
  OPPOSITE_VIEW,
  ORBIT_DEGREES_PER_PIXEL,
  X_ROT_LIMIT,
  ZOOM_DISTANCE_MIN,
  cursorCameraPosition,
  cursorDirection,
  cursorFromCamera,
  cursorQuaternion,
  dollyCursor,
  freelookCursor,
  freelookMoveCursor,
  orbitCursor,
  orthographicHeight,
  panCursor,
  pinchZoomScale,
  resolveNavMode,
  resolveTouchMode,
  resolveWheelMode,
  scaleCursorDistance,
  touchCentroid,
  touchSpan,
  viewSnapCursor,
  wheelDeltaPixels,
  wheelZoomScale,
  WHEEL_MAX_NOTCHES,
  WHEEL_ZOOM_MULTIPLIER,
  type EditorCursor,
  type GodotViewAngle,
} from './godotEditorCursor';

const ORIGIN = new THREE.Vector3();
const WIDE_RANGE = { near: 0.001, far: 100000 };

/** The pose Godot's editor opens every scene at. */
function editorCursor(): EditorCursor {
  return cursorFromCamera(new THREE.Vector3(...editorCameraPosition()), ORIGIN);
}

function cursorAt(xRot: number, yRot: number, distance = 4, target = ORIGIN): EditorCursor {
  return { target: target.clone(), xRot, yRot, distance };
}

describe('cursorFromCamera / cursorCameraPosition', () => {
  it('recovers Godot’s opening cursor from the camera the canvas opens with', () => {
    const cursor = editorCursor();
    expect(cursor.xRot).toBeCloseTo(EDITOR_CAMERA_X_ROT, 6);
    expect(cursor.yRot).toBeCloseTo(EDITOR_CAMERA_Y_ROT, 6);
    expect(cursor.distance).toBeCloseTo(EDITOR_CAMERA_DISTANCE, 6);
  });

  it('round-trips an arbitrary pose back to the same eye position', () => {
    const position = new THREE.Vector3(-3, 7, 2);
    const target = new THREE.Vector3(1, -1, 4);
    const back = cursorCameraPosition(cursorFromCamera(position, target));
    expect(back.distanceTo(position)).toBeLessThan(1e-9);
  });

  it('reports no rotation for an eye sitting on the focus point', () => {
    const cursor = cursorFromCamera(new THREE.Vector3(2, 2, 2), new THREE.Vector3(2, 2, 2));
    expect(cursor.distance).toBe(0);
    expect(cursor.xRot).toBe(0);
    expect(cursor.yRot).toBe(0);
  });

  it('builds the same direction from the quaternion as from the rotations', () => {
    const cursor = cursorAt(0.4, -1.2);
    const fromQuaternion = new THREE.Vector3(0, 0, 1).applyQuaternion(cursorQuaternion(cursor));
    expect(fromQuaternion.distanceTo(cursorDirection(cursor))).toBeLessThan(1e-9);
  });
});

describe('orbitCursor', () => {
  it('accumulates yaw and pitch at Godot’s orbit sensitivity', () => {
    const perPixel = (ORBIT_DEGREES_PER_PIXEL * Math.PI) / 180;
    const orbited = orbitCursor(orbitCursor(cursorAt(0, 0), 10, 4), 10, 4);
    expect(orbited.yRot).toBeCloseTo(20 * perPixel, 9);
    expect(orbited.xRot).toBeCloseTo(8 * perPixel, 9);
  });

  it('leaves the focus point and radius alone', () => {
    const cursor = cursorAt(0.2, 0.3, 9, new THREE.Vector3(1, 2, 3));
    const orbited = orbitCursor(cursor, 40, -25);
    expect(orbited.distance).toBe(9);
    expect(orbited.target.equals(cursor.target)).toBe(true);
  });

  it('clamps at the poles instead of flipping the view upside down', () => {
    const up = orbitCursor(cursorAt(0, 0), 0, 100000);
    const down = orbitCursor(cursorAt(0, 0), 0, -100000);
    expect(up.xRot).toBeCloseTo(X_ROT_LIMIT, 9);
    expect(down.xRot).toBeCloseTo(-X_ROT_LIMIT, 9);
    // Still above the focus point, and still the right way up.
    expect(cursorDirection(up).y).toBeGreaterThan(0.99);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(cursorQuaternion(up));
    expect(cameraUp.y).toBeGreaterThan(0);
  });
});

describe('panCursor', () => {
  it('moves the eye and the focus point by the same vector', () => {
    const cursor = editorCursor();
    const panned = panCursor(cursor, 30, -12);
    const targetDelta = panned.target.clone().sub(cursor.target);
    const eyeDelta = cursorCameraPosition(panned).sub(cursorCameraPosition(cursor));
    expect(eyeDelta.distanceTo(targetDelta)).toBeLessThan(1e-9);
    expect(targetDelta.length()).toBeGreaterThan(0);
  });

  it('slides in the view plane, never along the view direction', () => {
    const cursor = editorCursor();
    const delta = panCursor(cursor, 30, -12).target.clone().sub(cursor.target);
    expect(delta.dot(cursorDirection(cursor))).toBeCloseTo(0, 9);
  });

  it('scales with the orbit radius so far-out pans cover more ground', () => {
    const near = panCursor(cursorAt(0, 0, 1), 100, 0).target.length();
    const far = panCursor(cursorAt(0, 0, 10), 100, 0).target.length();
    expect(far).toBeCloseTo(near * 10, 9);
  });

  it('does nothing for a zero drag', () => {
    const cursor = editorCursor();
    expect(panCursor(cursor, 0, 0).target.equals(cursor.target)).toBe(true);
  });
});

describe('dollyCursor / scaleCursorDistance', () => {
  it('pushes out on a downward drag and pulls in on an upward one', () => {
    const cursor = cursorAt(0, 0, 4);
    expect(dollyCursor(cursor, 40, WIDE_RANGE).distance).toBeGreaterThan(4);
    expect(dollyCursor(cursor, -40, WIDE_RANGE).distance).toBeLessThan(4);
  });

  it('never reaches or crosses the focus point, however hard it is dragged', () => {
    let cursor = cursorAt(0, 0, 4);
    for (let i = 0; i < 200; i++) cursor = dollyCursor(cursor, -60, WIDE_RANGE);
    expect(cursor.distance).toBeGreaterThan(0);
    expect(cursorDirection(cursor).dot(cursorDirection(cursorAt(0, 0, 4)))).toBeCloseTo(1, 9);
  });

  it('is exactly invertible, so a drag that returns restores the radius', () => {
    const cursor = cursorAt(0, 0, 4);
    const there = dollyCursor(cursor, 25, WIDE_RANGE);
    expect(dollyCursor(there, -25, WIDE_RANGE).distance).toBeCloseTo(4, 9);
  });

  it('clamps to the range Godot derives from the clip planes', () => {
    const range = { near: 0.5, far: 400 };
    expect(scaleCursorDistance(cursorAt(0, 0, 4), 0.0001, range).distance).toBeCloseTo(2, 9);
    expect(scaleCursorDistance(cursorAt(0, 0, 4), 10000, range).distance).toBeCloseTo(100, 9);
  });

  it('falls back to the middle of an inverted range', () => {
    const range = { near: 900, far: 1000 };
    const distance = scaleCursorDistance(cursorAt(0, 0, 4), 1, range).distance;
    expect(distance).toBeCloseTo((Math.max(3600, ZOOM_DISTANCE_MIN) + 250) / 2, 9);
  });

  it('leaves the cursor untouched for a zero drag', () => {
    const cursor = cursorAt(0, 0, 4);
    expect(dollyCursor(cursor, 0, WIDE_RANGE)).toBe(cursor);
  });
});

describe('wheelZoomScale', () => {
  it('zooms in on a wheel-up and out on a wheel-down', () => {
    expect(wheelZoomScale({ deltaY: -100 })).toBeCloseTo(1 / 1.08, 9);
    expect(wheelZoomScale({ deltaY: 100 })).toBeCloseTo(1.08, 9);
  });

  it('normalises line- and page-mode deltas to the same notch', () => {
    // A browser reporting lines sends three of them per notch — the figure
    // Firefox uses. Reading a line as a ~16px text line would make this 0.48
    // of a notch and zoom Firefox at roughly half of Chrome's rate.
    expect(wheelZoomScale({ deltaY: 3, deltaMode: 1 })).toBeCloseTo(1.08, 9);
    expect(wheelZoomScale({ deltaY: 1, deltaMode: 2 })).toBeCloseTo(1.08, 9);
  });

  it('treats a trackpad’s small deltas as a fraction of a notch', () => {
    const scale = wheelZoomScale({ deltaY: 10 });
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeLessThan(1.08);
  });

  it('composes: a trackpad’s stream of small events zooms exactly as far as one big one', () => {
    // The whole point of scaling exponentially rather than linearly in
    // notches. A linear factor makes sixteen tiny events overshoot one
    // equivalent event, which is precisely the mouse-vs-trackpad mismatch.
    const streamed = Array.from({ length: 16 }, () => wheelZoomScale({ deltaY: 10 })).reduce(
      (a, b) => a * b,
      1
    );
    expect(streamed).toBeCloseTo(wheelZoomScale({ deltaY: 160 }), 9);
  });

  it('is symmetric: scrolling back undoes the zoom exactly', () => {
    expect(wheelZoomScale({ deltaY: 37 }) * wheelZoomScale({ deltaY: -37 })).toBeCloseTo(1, 12);
  });

  it('caps a single event so a kinetic fling cannot teleport the eye', () => {
    const capped = WHEEL_ZOOM_MULTIPLIER ** WHEEL_MAX_NOTCHES;
    expect(wheelZoomScale({ deltaY: 100_000 })).toBeCloseTo(capped, 9);
    expect(wheelZoomScale({ deltaY: -100_000 })).toBeCloseTo(1 / capped, 9);
  });

  it('is a no-op for a zero delta', () => {
    expect(wheelZoomScale({ deltaY: 0 })).toBe(1);
  });
});

describe('wheelDeltaPixels', () => {
  it('passes pixel-mode deltas through on both axes', () => {
    expect(wheelDeltaPixels({ deltaX: -12, deltaY: 34 })).toEqual({ dx: -12, dy: 34 });
  });

  it('scales line and page modes to the same pixel distance', () => {
    expect(wheelDeltaPixels({ deltaY: 3, deltaMode: 1 }).dy).toBeCloseTo(100, 9);
    expect(wheelDeltaPixels({ deltaY: 1, deltaMode: 2 }).dy).toBeCloseTo(100, 9);
  });

  it('defaults a missing horizontal axis to zero', () => {
    expect(wheelDeltaPixels({ deltaY: 5 }).dx).toBe(0);
  });
});

describe('resolveWheelMode', () => {
  it('zooms unmodified — the mouse wheel’s own Godot binding owns that slot', () => {
    expect(resolveWheelMode({})).toBe('zoom');
  });

  it('pans on shift, Godot’s pan-gesture modifier', () => {
    expect(resolveWheelMode({ shiftKey: true })).toBe('pan');
  });

  it('zooms on ctrl, which is both Godot’s zoom modifier and a trackpad pinch', () => {
    expect(resolveWheelMode({ ctrlKey: true })).toBe('zoom');
    // A pinch reports ctrl; shift held at the same time must not turn it into
    // a pan, or a shift-pinch would fly the view off instead of zooming.
    expect(resolveWheelMode({ ctrlKey: true, shiftKey: true })).toBe('zoom');
  });
});

describe('resolveTouchMode', () => {
  it('orbits on one finger and pans on two', () => {
    expect(resolveTouchMode(1)).toBe('orbit');
    expect(resolveTouchMode(2)).toBe('pan');
  });

  it('claims nothing for no fingers or for three and up', () => {
    expect(resolveTouchMode(0)).toBeNull();
    expect(resolveTouchMode(3)).toBeNull();
  });
});

describe('touchCentroid / touchSpan', () => {
  it('takes the midpoint and the separation of two fingers', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ];
    expect(touchCentroid(points)).toEqual({ x: 5, y: 10 });
    expect(touchSpan(points)).toBeCloseTo(Math.hypot(10, 20), 9);
  });

  it('reports a single finger as its own centroid with no span', () => {
    expect(touchCentroid([{ x: 7, y: 9 }])).toEqual({ x: 7, y: 9 });
    expect(touchSpan([{ x: 7, y: 9 }])).toBe(0);
  });

  it('survives an empty pointer set', () => {
    expect(touchCentroid([])).toEqual({ x: 0, y: 0 });
    expect(touchSpan([])).toBe(0);
  });
});

describe('pinchZoomScale', () => {
  it('pulls the eye in as the fingers spread', () => {
    expect(pinchZoomScale(100, 200)).toBeCloseTo(0.5, 9);
  });

  it('pushes the eye out as the fingers close', () => {
    expect(pinchZoomScale(200, 100)).toBeCloseTo(2, 9);
  });

  it('is a no-op for a degenerate span rather than dividing by zero', () => {
    expect(pinchZoomScale(0, 100)).toBe(1);
    expect(pinchZoomScale(100, 0)).toBe(1);
  });
});

describe('freelookCursor', () => {
  it('turns the view without moving the eye', () => {
    const cursor = editorCursor();
    const looked = freelookCursor(cursor, 45, 20);
    expect(cursorCameraPosition(looked).distanceTo(cursorCameraPosition(cursor))).toBeLessThan(
      1e-9
    );
    expect(cursorDirection(looked).distanceTo(cursorDirection(cursor))).toBeGreaterThan(0.01);
  });

  it('drags the focus point around in front of the eye', () => {
    const cursor = editorCursor();
    const looked = freelookCursor(cursor, 45, 0);
    expect(looked.target.distanceTo(cursor.target)).toBeGreaterThan(0);
    expect(looked.distance).toBeCloseTo(cursor.distance, 9);
  });

  it('clamps the pitch at the poles like orbiting does', () => {
    expect(freelookCursor(cursorAt(0, 0), 0, 100000).xRot).toBeCloseTo(X_ROT_LIMIT, 9);
  });
});

describe('freelookMoveCursor', () => {
  const HELD = { forward: true } as const;

  it('flies along the view direction at Godot’s base speed', () => {
    const cursor = cursorAt(0, 0, 4);
    const moved = freelookMoveCursor(cursor, HELD, 0.5);
    const delta = moved.target.clone().sub(cursor.target);
    expect(delta.length()).toBeCloseTo(FREELOOK_BASE_SPEED * 0.5, 9);
    // Forward is -Z at zero rotation.
    expect(delta.z).toBeCloseTo(-FREELOOK_BASE_SPEED * 0.5, 9);
  });

  it('carries the eye with the focus point, leaving the view direction alone', () => {
    const cursor = editorCursor();
    const moved = freelookMoveCursor(cursor, HELD, 0.25);
    const eyeDelta = cursorCameraPosition(moved).sub(cursorCameraPosition(cursor));
    expect(eyeDelta.distanceTo(moved.target.clone().sub(cursor.target))).toBeLessThan(1e-9);
    expect(cursorDirection(moved).distanceTo(cursorDirection(cursor))).toBeLessThan(1e-9);
  });

  it('sprints on Shift', () => {
    const plain = freelookMoveCursor(cursorAt(0, 0), HELD, 0.5).target.length();
    const sprinting = freelookMoveCursor(
      cursorAt(0, 0),
      { forward: true, sprint: true },
      0.5
    ).target.length();
    expect(sprinting).toBeCloseTo(plain * FREELOOK_SPRINT_MULTIPLIER, 9);
  });

  it('moves up and down along the camera’s own up axis', () => {
    const cursor = cursorAt(0, 0);
    expect(freelookMoveCursor(cursor, { up: true }, 0.2).target.y).toBeGreaterThan(0);
    expect(freelookMoveCursor(cursor, { down: true }, 0.2).target.y).toBeLessThan(0);
  });

  it('returns the same cursor when nothing is held', () => {
    const cursor = cursorAt(0, 0);
    expect(freelookMoveCursor(cursor, {}, 0.2)).toBe(cursor);
    expect(freelookMoveCursor(cursor, { sprint: true }, 0.2)).toBe(cursor);
  });
});

describe('viewSnapCursor', () => {
  const EXPECTED: Record<GodotViewAngle, [number, number, number]> = {
    front: [0, 0, 1],
    rear: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0],
    bottom: [0, -1, 0],
  };

  for (const [view, expected] of Object.entries(EXPECTED) as [
    GodotViewAngle,
    [number, number, number],
  ][]) {
    it(`looks at the scene from the ${view}`, () => {
      const snapped = viewSnapCursor(editorCursor(), view);
      const direction = cursorDirection(snapped);
      expect(direction.distanceTo(new THREE.Vector3(...expected))).toBeLessThan(1e-9);
    });
  }

  it('keeps the focus point and the radius, so the same content stays framed', () => {
    const cursor = cursorAt(0.3, 1.1, 12, new THREE.Vector3(4, 5, 6));
    const snapped = viewSnapCursor(cursor, 'top');
    expect(snapped.distance).toBe(12);
    expect(snapped.target.equals(cursor.target)).toBe(true);
  });

  it('pairs every view with the face across from it', () => {
    for (const [view, opposite] of Object.entries(OPPOSITE_VIEW) as [
      GodotViewAngle,
      GodotViewAngle,
    ][]) {
      const a = cursorDirection(viewSnapCursor(cursorAt(0, 0), view));
      const b = cursorDirection(viewSnapCursor(cursorAt(0, 0), opposite));
      expect(a.dot(b)).toBeCloseTo(-1, 9);
    }
  });
});

describe('orthographicHeight', () => {
  it('matches what the perspective camera sees at the focus point', () => {
    const distance = 4;
    const expected = 2 * distance * Math.tan(((EDITOR_CAMERA_FOV / 2) * Math.PI) / 180);
    expect(orthographicHeight(distance, EDITOR_CAMERA_FOV)).toBeCloseTo(expected, 9);
  });

  it('scales with the zoom radius, which is what makes zoom visible in ortho', () => {
    expect(orthographicHeight(8, EDITOR_CAMERA_FOV)).toBeCloseTo(
      2 * orthographicHeight(4, EDITOR_CAMERA_FOV),
      9
    );
  });

  it('collapses to nothing at zero distance', () => {
    expect(orthographicHeight(0, EDITOR_CAMERA_FOV)).toBe(0);
  });
});

describe('resolveNavMode', () => {
  it('maps the middle button to orbit, shift to pan and ctrl to zoom', () => {
    expect(resolveNavMode(1, {})).toBe('orbit');
    expect(resolveNavMode(1, { shiftKey: true })).toBe('pan');
    expect(resolveNavMode(1, { ctrlKey: true })).toBe('zoom');
  });

  it('maps the right button to freelook whatever is held', () => {
    expect(resolveNavMode(2, {})).toBe('freelook');
    expect(resolveNavMode(2, { shiftKey: true })).toBe('freelook');
  });

  it('emulates the middle button on alt+left', () => {
    expect(resolveNavMode(0, { altKey: true })).toBe('orbit');
    expect(resolveNavMode(0, { altKey: true, shiftKey: true })).toBe('pan');
  });

  it('leaves plain left-drag to viewport selection', () => {
    expect(resolveNavMode(0, {})).toBeNull();
    expect(resolveNavMode(0, { shiftKey: true })).toBeNull();
    expect(resolveNavMode(3, { altKey: true })).toBeNull();
  });
});
