/**
 * The <Line2D> R3F component, whatever its drawing primitive. A multi-point line
 * draws geometry coloured by `default_color` and Y-negated into three's frame. A
 * line of fewer than 2 points draws nothing but keeps the CanvasItem2D group.
 */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Line2D } from './Component';
import { parseLine2D } from './parser';
import type { ParsedHeading } from '../../../parser/utils';
import type { TscnNode } from '../../../parser/types';

function node(rawProps: Record<string, string>, name = 'Line'): TscnNode {
  const heading: ParsedHeading = { type: 'node', attributes: { name, type: 'Line2D' } };
  return { name, type: 'Line2D', children: [], properties: parseLine2D(heading, rawProps) };
}

const render = (n: TscnNode) => ReactThreeTestRenderer.create(<Line2D node={n} />);

/**
 * Primitive-agnostic: a Line2D may render as a THREE.Line/LineSegments or a
 * width-aware mesh. Collect every drawn object carrying a geometry.
 */
function drawn(renderer: Awaited<ReturnType<typeof render>>) {
  const types = ['Line', 'LineSegments', 'Line2', 'LineSegments2', 'Mesh'];
  return types
    .flatMap((t) => renderer.scene.findAllByType(t))
    .filter((o) => Boolean((o.instance as THREE.Mesh).geometry));
}

describe('<Line2D>', () => {
  it('draws a polyline primitive for a multi-point line', async () => {
    const renderer = await render(
      node({ points: 'PackedVector2Array(0, 0, 100, 0, 100, 100)', width: '30.0' })
    );
    expect(drawn(renderer).length).toBeGreaterThan(0);
  });

  it('strokes each segment as a FULL quad (two triangles), not a half-ribbon', async () => {
    // 3 points → 2 segments, each a 4-vertex quad of 2 triangles. A non-indexed
    // quad draws one triangle, a half-ribbon, which the bounding-box and colour
    // assertions alone would accept.
    const renderer = await render(
      node({ points: 'PackedVector2Array(0, 0, 100, 0, 100, 100)', width: '20.0' })
    );
    const geom = (drawn(renderer)[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    const triangles = geom.index
      ? geom.index.count / 3
      : geom.attributes.position!.count / 3;
    expect(triangles).toBeGreaterThanOrEqual(4); // 2 segments × 2 triangles
  });

  it('colours the line by default_color', async () => {
    const renderer = await render(
      node({ points: 'PackedVector2Array(0, 0, 100, 0)', default_color: 'Color(1, 0, 0, 1)' })
    );
    // Red has only 0/1 channels, so it is invariant under sRGB→linear: assert
    // some drawn primitive's material is red, whichever primitive was used.
    const isRed = drawn(renderer).some((o) => {
      const color = (o.instance as THREE.Mesh).material
        ? ((o.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).color
        : undefined;
      return Boolean(color && color.r > 0.9 && color.g < 0.1 && color.b < 0.1);
    });
    expect(isRed).toBe(true);
  });

  it('negates Y so Godot +Y-down maps into the conjugated 2D frame', async () => {
    const renderer = await render(
      node({ points: 'PackedVector2Array(0, 0, 0, 100)' })
    );
    const geom = (drawn(renderer)[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    geom.computeBoundingBox();
    // Godot y ∈ [0,100] → three y ∈ [-100, 0] (width expands x, not y, on a
    // vertical segment with no end caps).
    expect(geom.boundingBox!.min.y).toBeCloseTo(-100, 0);
    expect(geom.boundingBox!.max.y).toBeCloseTo(0, 0);
  });

  it('draws nothing for empty points but keeps the group', async () => {
    const renderer = await render(node({ points: 'PackedVector2Array()' }));
    expect(drawn(renderer)).toHaveLength(0);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('draws nothing for a single point (no segment to stroke)', async () => {
    const renderer = await render(node({ points: 'PackedVector2Array(5, 5)' }));
    expect(drawn(renderer)).toHaveLength(0);
  });
});
