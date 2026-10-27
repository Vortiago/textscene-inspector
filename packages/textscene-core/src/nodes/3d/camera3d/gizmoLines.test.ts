/**
 * The lines of the Camera3D gizmo (`camera_3d_gizmo_plugin.cpp:139-258`). The expected vertices come
 * from a GDScript port of `redraw` that ran in Godot 4.6.3, through the engine's own `Vector3` maths.
 */
import { describe, expect, it } from 'vitest';
import { Camera3DKeepAspect, Camera3DProjectionType } from '../../../godot/scene/camera3d';
import { cameraGizmoLines, type CameraGizmoInput } from './gizmoLines';

type Point = readonly [number, number, number];

const ASPECT_16_9 = 16 / 9;
const ORIGIN: Point = [0, 0, 0];

/** `ADD_TRIANGLE` and `ADD_QUAD` (`:154-174`): each side of the closed outline, start then end. */
function outline(...corners: Point[]): number[] {
  return corners.flatMap((start, index) => [...start, ...corners[(index + 1) % corners.length]!]);
}

function perspective(
  overrides: Partial<CameraGizmoInput['lens']> = {},
  aspect = ASPECT_16_9
): CameraGizmoInput {
  return {
    lens: {
      projection: Camera3DProjectionType.PERSPECTIVE,
      fov: 75,
      size: 1,
      keepAspect: Camera3DKeepAspect.KEEP_HEIGHT,
      frustumOffset: { x: 0, y: 0 },
      ...overrides,
    },
    near: 0.05,
    aspect,
  };
}

function orthogonal(size: number, overrides: Partial<CameraGizmoInput['lens']> = {}, aspect = ASPECT_16_9) {
  return perspective({ projection: Camera3DProjectionType.ORTHOGONAL, size, ...overrides }, aspect);
}

function frustum(
  size: number,
  near: number,
  frustumOffset = { x: 0, y: 0 },
  aspect = ASPECT_16_9
): CameraGizmoInput {
  const input = perspective({ projection: Camera3DProjectionType.FRUSTUM, size, frustumOffset }, aspect);
  return { ...input, near };
}

/** The lines are `Float32Array` positions, so compare them to the float digits that Godot printed. */
function expectLines(actual: Float32Array, expected: number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 6));
}

describe('cameraGizmoLines', () => {
  describe('perspective', () => {
    it('draws four triangles from the origin and the up triangle at the default fov 75 over 16:9', () => {
      const corner = (x: number, y: number): Point => [x, y, -0.4462613];
      const side = 0.6087614;
      const up = 0.3424283;
      expectLines(cameraGizmoLines(perspective()), [
        ...outline(ORIGIN, corner(side, up), corner(side, -up)),
        ...outline(ORIGIN, corner(-side, up), corner(-side, -up)),
        ...outline(ORIGIN, corner(side, up), corner(-side, up)),
        ...outline(ORIGIN, corner(side, -up), corner(-side, -up)),
        ...outline([0, 0.646809, -0.4462613], corner(0.1521904, up), corner(-0.1521904, up)),
      ]);
    });

    it('narrows the pyramid for fov 30', () => {
      const corner = (x: number, y: number): Point => [x, y, -0.5433333];
      const side = 0.258819;
      const up = 0.1455857;
      expectLines(cameraGizmoLines(perspective({ fov: 30 })), [
        ...outline(ORIGIN, corner(side, up), corner(side, -up)),
        ...outline(ORIGIN, corner(-side, up), corner(-side, -up)),
        ...outline(ORIGIN, corner(side, up), corner(-side, up)),
        ...outline(ORIGIN, corner(side, -up), corner(-side, -up)),
        ...outline([0, 0.2749952, -0.5433333], corner(0.0647048, up), corner(-0.0647048, up)),
      ]);
    });

    it('sets the depth of the far corners by the width factor under KEEP_WIDTH', () => {
      const lines = cameraGizmoLines(perspective({ keepAspect: Camera3DKeepAspect.KEEP_WIDTH }));
      expect(Array.from(lines.subarray(3, 6))).toEqual([
        expect.closeTo(0.6087614, 6),
        expect.closeTo(0.3424283, 6),
        expect.closeTo(-0.7933533, 6),
      ]);
    });

    it('keeps the width factor 1 and shrinks the height factor above aspect 1, and the reverse below it', () => {
      const wide = cameraGizmoLines(perspective({}, 2));
      const tall = cameraGizmoLines(perspective({}, 0.5));
      expect(wide[4]).toBeCloseTo(0.6087614 / 2, 6);
      expect(wide[3]).toBeCloseTo(0.6087614, 6);
      expect(tall[3]).toBeCloseTo(0.6087614 / 2, 6);
      expect(tall[4]).toBeCloseTo(0.6087614, 6);
    });

    it('reads a viewport with no aspect as aspect 1 (edge case, `:151`)', () => {
      expect(cameraGizmoLines(perspective({}, 0))).toEqual(cameraGizmoLines(perspective({}, 1)));
    });
  });

  describe('orthogonal', () => {
    it('draws two quads at z 0 and -1, the joining sides and the up triangle for size 1 over 16:9', () => {
      const x = 0.8888889;
      const near = (px: number, py: number): Point => [px, py, 0];
      const far = (px: number, py: number): Point => [px, py, -1];
      expectLines(cameraGizmoLines(orthogonal(1)), [
        ...outline(near(-x, -0.5), near(x, -0.5), near(x, 0.5), near(-x, 0.5)),
        ...outline(far(-x, -0.5), far(x, -0.5), far(x, 0.5), far(-x, 0.5)),
        ...outline(near(x, 0.5), far(x, 0.5), far(-x, 0.5), near(-x, 0.5)),
        ...outline(near(x, -0.5), far(x, -0.5), far(-x, -0.5), near(-x, -0.5)),
        ...outline([0, 0.75, -1], far(0.125, 0.5), far(-0.125, 0.5)),
      ]);
    });

    it('scales the box by size 5', () => {
      const x = 4.4444447;
      const lines = cameraGizmoLines(orthogonal(5));
      expectLines(lines.subarray(0, 6), [-x, -2.5, 0, x, -2.5, 0]);
      expectLines(lines.subarray(lines.length - 18, lines.length - 12), [0, 3.75, -1, 0.625, 2.5, -1]);
    });

    it('keeps the width under KEEP_WIDTH and divides the height by the aspect', () => {
      const lines = cameraGizmoLines(orthogonal(5, { keepAspect: Camera3DKeepAspect.KEEP_WIDTH }));
      expect(lines[0]).toBeCloseTo(-2.5, 6);
      expect(lines[1]).toBeCloseTo(-1.40625, 6);
    });
  });

  describe('frustum', () => {
    it('shifts every corner but the origin by frustum_offset (size 1, near 0.05, offset (0.25, -0.5))', () => {
      const corner = (x: number, y: number): Point => [x, y, -0.0995037];
      expectLines(cameraGizmoLines(frustum(1, 0.05, { x: 0.25, y: -0.5 })), [
        ...outline(ORIGIN, corner(1.2450371, -0.21875), corner(1.2450371, -0.78125)),
        ...outline(ORIGIN, corner(-0.7450371, -0.21875), corner(-0.7450371, -0.78125)),
        ...outline(ORIGIN, corner(1.2450371, -0.21875), corner(-0.7450371, -0.21875)),
        ...outline(ORIGIN, corner(1.2450371, -0.78125), corner(-0.7450371, -0.78125)),
        ...outline([0.25, 0.03125, -0.0995037], corner(0.375, -0.21875), corner(0.125, -0.21875)),
      ]);
    });

    it('normalises the side with the near plane (size 4, near 1, no offset)', () => {
      const lines = cameraGizmoLines(frustum(4, 1));
      expect(Array.from(lines.subarray(3, 6))).toEqual([
        expect.closeTo(0.8944272, 6),
        expect.closeTo(1.125, 6),
        expect.closeTo(-0.4472136, 6),
      ]);
    });
  });

  it('builds 15 segments for a perspective or frustum camera and 19 for an orthogonal one', () => {
    expect(cameraGizmoLines(perspective())).toHaveLength(15 * 6);
    expect(cameraGizmoLines(frustum(1, 0.05))).toHaveLength(15 * 6);
    expect(cameraGizmoLines(orthogonal(1))).toHaveLength(19 * 6);
  });
});
