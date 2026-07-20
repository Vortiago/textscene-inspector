/**
 * Line2D joint wedges.
 *
 * The stroke draws one independent butt-capped quad per segment, leaving a
 * pie-slice gap outside every interior corner. Godot has no "no joint" mode —
 * `joint_mode` defaults to LINE_JOINT_SHARP — so the gap is always filled, and
 * a polyline without one reads as a broken chain of bars.
 */
import { describe, expect, it } from 'vitest';
import { jointWedge, LINE_JOINT_BEVEL, LINE_JOINT_ROUND, LINE_JOINT_SHARP } from './lineJoints';

const SHARP = { jointMode: LINE_JOINT_SHARP, sharpLimit: 2, roundPrecision: 8 };

/** A right-angle corner: in from the left, out downward. */
const PREV = { x: -10, y: 0 };
const CORNER = { x: 0, y: 0 };
const NEXT = { x: 0, y: -10 };

function triangleCount(vertices: number[]): number {
  return vertices.length / 9;
}

describe('jointWedge', () => {
  it('emits nothing for a straight run', () => {
    expect(jointWedge({ x: -10, y: 0 }, CORNER, { x: 10, y: 0 }, 5, SHARP)).toEqual([]);
  });

  it('emits nothing for a degenerate (zero-length) segment', () => {
    expect(jointWedge(CORNER, CORNER, NEXT, 5, SHARP)).toEqual([]);
  });

  it('miters a right angle into two triangles', () => {
    expect(triangleCount(jointWedge(PREV, CORNER, NEXT, 5, SHARP))).toBe(2);
  });

  it('places the miter tip a half-width x sqrt(2) out on a right angle', () => {
    const wedge = jointWedge(PREV, CORNER, NEXT, 5, SHARP);
    // Triangle 1 is (corner, a, tip) → the tip is its third vertex.
    const tip = { x: wedge[6]!, y: wedge[7]! };
    expect(Math.hypot(tip.x, tip.y)).toBeCloseTo(5 * Math.SQRT2, 5);
  });

  it('falls back to a bevel when the miter runs past sharp_limit', () => {
    // The line nearly doubles back on itself — an acute turn whose miter tip
    // runs far out. Godot bevels those instead of drawing a long spike.
    const doublesBack = { x: -10, y: -1 };
    expect(triangleCount(jointWedge(PREV, CORNER, doublesBack, 5, SHARP))).toBe(1);
    // The same corner miters happily once the limit is raised past its length.
    const generous = { ...SHARP, sharpLimit: 100 };
    expect(triangleCount(jointWedge(PREV, CORNER, doublesBack, 5, generous))).toBe(2);
  });

  it('bevels with a single triangle', () => {
    const bevel = { ...SHARP, jointMode: LINE_JOINT_BEVEL };
    expect(triangleCount(jointWedge(PREV, CORNER, NEXT, 5, bevel))).toBe(1);
  });

  it('rounds with round_precision triangles', () => {
    const round = { jointMode: LINE_JOINT_ROUND, sharpLimit: 2, roundPrecision: 6 };
    expect(triangleCount(jointWedge(PREV, CORNER, NEXT, 5, round))).toBe(6);
  });

  it('keeps every round-joint vertex a half-width from the corner', () => {
    const round = { jointMode: LINE_JOINT_ROUND, sharpLimit: 2, roundPrecision: 4 };
    const wedge = jointWedge(PREV, CORNER, NEXT, 5, round);
    for (let i = 0; i < wedge.length; i += 3) {
      const d = Math.hypot(wedge[i]!, wedge[i + 1]!);
      // Every vertex is either the corner itself or on the arc.
      expect(d === 0 || Math.abs(d - 5) < 1e-6).toBe(true);
    }
  });

  it('fills the OUTSIDE of the turn, whichever way it bends', () => {
    const left = jointWedge(PREV, CORNER, { x: 0, y: 10 }, 5, SHARP);
    const right = jointWedge(PREV, CORNER, { x: 0, y: -10 }, 5, SHARP);
    // The wedge sits on the opposite side of the corner from the turn.
    expect(left[7]!).toBeLessThan(0);
    expect(right[7]!).toBeGreaterThan(0);
  });
});
