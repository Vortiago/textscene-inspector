import { describe, expect, it } from 'vitest';
import { connectionStrokeGeometry } from './connectionStroke';

const RED = { r: 1, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };
const RIM = { r: 0.1, g: 0.1, b: 0.1, a: 0.6 };

describe('connectionStrokeGeometry', () => {
  it('emits 6 ring vertices per sample point and 5 quads per segment', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const geo = connectionStrokeGeometry(points, 8, RED, BLUE, RIM);
    expect(geo.positions.length).toBe(2 * 6 * 3);
    expect(geo.colors.length).toBe(2 * 6 * 4);
    expect(geo.indices.length).toBe((points.length - 1) * 5 * 6);
  });

  it('the outermost ring is fully transparent — the shader\'s fixed fake-AA fade (graph_edit.cpp:232-233)', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const geo = connectionStrokeGeometry(points, 8, RED, RED, RIM);
    // 6 vertices per point; the first and last of each group are the outer edge.
    expect(geo.colors[3]).toBe(0);
    expect(geo.colors[6 * 4 - 1]).toBe(0);
  });

  it('the centre ring carries the endpoint colour, interpolated along cumulative length', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    const geo = connectionStrokeGeometry(points, 8, RED, BLUE, RIM);
    // Point 0 (t=0): core rings are indices 2 and 3 of its 6-vertex group.
    const p0CoreStart = 0 * 6 * 4 + 2 * 4;
    expect([geo.colors[p0CoreStart], geo.colors[p0CoreStart + 1], geo.colors[p0CoreStart + 2]]).toEqual([1, 0, 0]);
    // Point 2 (t=1, last of 3 points, halfway along a straight line): full BLUE.
    const p2CoreStart = 2 * 6 * 4 + 2 * 4;
    expect([geo.colors[p2CoreStart], geo.colors[p2CoreStart + 1], geo.colors[p2CoreStart + 2]]).toEqual([0, 0, 1]);
  });

  it('returns empty buffers for fewer than two points', () => {
    expect(connectionStrokeGeometry([{ x: 0, y: 0 }], 8, RED, BLUE, RIM)).toEqual({
      positions: [],
      indices: [],
      colors: [],
    });
  });
});
