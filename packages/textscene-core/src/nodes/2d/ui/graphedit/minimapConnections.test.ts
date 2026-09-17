import { describe, expect, it } from 'vitest';
import type { ResolvedConnection } from './connectionEndpoints';
import type { MinimapTransform } from './minimap';
import { minimapConnectionLines } from './minimapConnections';

const RED = { r: 1, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };

/** Halves both axes: `renderSize / graphProportions` is (0.5, 0.5). */
const ISOTROPIC: MinimapTransform = {
  renderSize: { x: 100, y: 50 },
  graphProportions: { x: 200, y: 100 },
  minimapOffset: { x: 5, y: 7 },
};

const BOUNDS = { min: { x: -10, y: -20 }, max: { x: 190, y: 80 } };

function connection(from: { x: number; y: number }, to: { x: number; y: number }): ResolvedConnection {
  return {
    from: { pos: { x: 0, y: 0 }, graphPos: from, color: RED },
    to: { pos: { x: 0, y: 0 }, graphPos: to, color: BLUE },
  };
}

describe('minimapConnectionLines', () => {
  it('shifts by min_scroll_offset, then maps each point into the minimap (graph_edit.cpp:1872,1596-1598)', () => {
    const [line] = minimapConnectionLines([connection({ x: 10, y: 20 }, { x: 210, y: 20 })], ISOTROPIC, BOUNDS, 0);
    // A straight line at curvature 0 tessellates to its own two anchors.
    expect(line!.points).toEqual([
      { x: 15, y: 27 },
      { x: 115, y: 27 },
    ]);
  });

  it('lerps each point\'s colour by its normalized distance along the line (:1603-1608)', () => {
    const [line] = minimapConnectionLines([connection({ x: 10, y: 20 }, { x: 210, y: 20 })], ISOTROPIC, BOUNDS, 0);
    expect(line!.colors).toEqual([RED, BLUE]);
  });

  it('tessellates the curve before mapping, so a curved line gains interior points', () => {
    const [line] = minimapConnectionLines([connection({ x: 10, y: 20 }, { x: 210, y: 120 })], ISOTROPIC, BOUNDS, 0.5);
    expect(line!.points.length).toBeGreaterThan(2);
    expect(line!.colors[0]).toEqual(RED);
    expect(line!.colors[line!.colors.length - 1]).toEqual(BLUE);
  });

  it('measures the colour ramp in MINIMAP space, so the aspect ratio moves it (:1596 converts first)', () => {
    const anisotropic: MinimapTransform = { ...ISOTROPIC, graphProportions: { x: 200, y: 400 } };
    const curved = connection({ x: 10, y: 20 }, { x: 210, y: 120 });
    const [isotropic] = minimapConnectionLines([curved], ISOTROPIC, BOUNDS, 0.5);
    const [squashed] = minimapConnectionLines([curved], anisotropic, BOUNDS, 0.5);
    const middle = Math.floor(isotropic!.colors.length / 2);
    expect(squashed!.colors[middle]!.b).not.toBeCloseTo(isotropic!.colors[middle]!.b, 6);
  });

  it('carries one line per resolved connection and none for an empty list', () => {
    expect(minimapConnectionLines([], ISOTROPIC, BOUNDS, 0.5)).toEqual([]);
    expect(
      minimapConnectionLines(
        [connection({ x: 0, y: 0 }, { x: 40, y: 0 }), connection({ x: 0, y: 10 }, { x: 40, y: 10 })],
        ISOTROPIC,
        BOUNDS,
        0
      )
    ).toHaveLength(2);
  });

  it('collapses to a single location when both endpoints coincide, as the engine does', () => {
    // `Vector2::normalized()` of a zero vector is zero, so every tolerance test
    // in `Curve2D::_bake_segment2d` fails and the degenerate curve subdivides
    // to the full 5 stages. Every point still lands on the one position.
    const [line] = minimapConnectionLines([connection({ x: 30, y: 30 }, { x: 30, y: 30 })], ISOTROPIC, BOUNDS, 0.5);
    expect(new Set(line!.points.map((p) => `${p.x},${p.y}`)).size).toBe(1);
  });
});
