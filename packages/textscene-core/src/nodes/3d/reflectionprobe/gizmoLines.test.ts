/** The lines of the ReflectionProbe gizmo (`reflection_probe_gizmo_plugin.cpp:149-212`). */
import { describe, expect, it } from 'vitest';
import { reflectionProbeGizmoLines } from './gizmoLines';

const v = (x: number, y = x, z = x) => ({ x, y, z });
const ORIGIN = v(0);

/** The segments of `lines`, each as its six numbers. */
function segments(lines: number[]): number[][] {
  return Array.from({ length: lines.length / 6 }, (_, index) => lines.slice(index * 6, index * 6 + 6));
}

describe('reflectionProbeGizmoLines', () => {
  describe('the blend box', () => {
    it('draws its 12 edges, inset by the blend distance (default: size 20, blend 1)', () => {
      const { lines } = reflectionProbeGizmoLines({ size: v(20), blendDistance: 1, originOffset: ORIGIN });
      expect(segments(lines)).toHaveLength(12);
      expect(segments(lines)[0]).toEqual([9, -9, -9, -9, -9, -9]);
      expect(Math.max(...lines)).toBe(9);
    });

    it('draws no edge of the outer box', () => {
      const { lines } = reflectionProbeGizmoLines({ size: v(20), blendDistance: 1, originOffset: ORIGIN });
      expect(lines).not.toContain(10);
      expect(lines).not.toContain(-10);
    });

    it('insets each axis by its own size (size 20 x 10 x 4, blend 1)', () => {
      const { lines } = reflectionProbeGizmoLines({
        size: v(20, 10, 4),
        blendDistance: 1,
        originOffset: ORIGIN,
      });
      expect(segments(lines)[0]).toEqual([9, -4, -1, -9, -4, -1]);
    });

    it('collapses an axis that the inset would invert onto the centre (size 20, blend 12)', () => {
      const { lines } = reflectionProbeGizmoLines({ size: v(20), blendDistance: 12, originOffset: ORIGIN });
      expect(lines).toEqual(new Array(72).fill(0));
    });

    it('collapses only the axes that invert (size 20 x 40 x 20, blend 12)', () => {
      const { lines } = reflectionProbeGizmoLines({
        size: v(20, 40, 20),
        blendDistance: 12,
        originOffset: ORIGIN,
      });
      expect(segments(lines)[0]).toEqual([0, -8, 0, 0, -8, 0]);
    });

    it('draws a box of size 0 on the centre where the inset meets it (size 20, blend 10, edge case)', () => {
      const { lines } = reflectionProbeGizmoLines({ size: v(20), blendDistance: 10, originOffset: ORIGIN });
      expect(lines).toEqual(new Array(72).fill(0));
    });

    it('grows the box past the outer box for a negative blend distance (edge case)', () => {
      const { lines } = reflectionProbeGizmoLines({ size: v(20), blendDistance: -1, originOffset: ORIGIN });
      expect(segments(lines)[0]).toEqual([11, -11, -11, -11, -11, -11]);
    });

    it('draws no line for a blend distance of 0, whatever the size (edge case)', () => {
      const probe = { size: v(20), blendDistance: 0, originOffset: ORIGIN };
      expect(reflectionProbeGizmoLines(probe)).toEqual({ lines: [], internalLines: [] });
    });
  });

  describe('the internal lines', () => {
    it('join each blend corner to the matching outer corner, in the order of AABB::get_endpoint', () => {
      const { internalLines } = reflectionProbeGizmoLines({
        size: v(20),
        blendDistance: 1,
        originOffset: ORIGIN,
      });
      expect(segments(internalLines)).toEqual([
        [-9, -9, -9, -10, -10, -10],
        [-9, -9, 9, -10, -10, 10],
        [-9, 9, -9, -10, 10, -10],
        [-9, 9, 9, -10, 10, 10],
        [9, -9, -9, 10, -10, -10],
        [9, -9, 9, 10, -10, 10],
        [9, 9, -9, 10, 10, -10],
        [9, 9, 9, 10, 10, 10],
      ]);
    });

    it('start on the centre when the blend box has collapsed (size 20, blend 12)', () => {
      const { internalLines } = reflectionProbeGizmoLines({
        size: v(20),
        blendDistance: 12,
        originOffset: ORIGIN,
      });
      expect(segments(internalLines)[0]).toEqual([0, 0, 0, -10, -10, -10]);
    });
  });

  describe('the origin cross', () => {
    it('draws three segments of 0.5 centred on a non-zero origin offset, after the blend box', () => {
      const { lines } = reflectionProbeGizmoLines({
        size: v(20),
        blendDistance: 0,
        originOffset: v(3, 0, 0),
      });
      expect(segments(lines)).toEqual([
        [2.75, 0, 0, 3.25, 0, 0],
        [3, -0.25, 0, 3, 0.25, 0],
        [3, 0, -0.25, 3, 0, 0.25],
      ]);
    });

    it('follows the 12 blend edges in the same array', () => {
      const { lines } = reflectionProbeGizmoLines({
        size: v(20),
        blendDistance: 1,
        originOffset: v(0, 2, 0),
      });
      expect(segments(lines)).toHaveLength(15);
      expect(segments(lines)[12]).toEqual([-0.25, 2, 0, 0.25, 2, 0]);
    });

    it('is absent for a zero origin offset (edge case)', () => {
      const { lines } = reflectionProbeGizmoLines({ size: v(20), blendDistance: 1, originOffset: ORIGIN });
      expect(segments(lines)).toHaveLength(12);
    });
  });
});
