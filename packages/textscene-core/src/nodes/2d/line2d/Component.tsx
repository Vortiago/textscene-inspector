/**
 * <Line2D> — a stroked polyline drawn as mesh quads. Each segment (p0→p1)
 * becomes one quad whose vertices run perpendicular to the segment direction,
 * offset by width/2 on each side. Butt caps (no extension), simple overlapping
 * joints, Z = 0. No miter or round join for v1.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { multiplyModulate, type CanvasItemTint } from '../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../r3f/godotColor';
import type { Line2DProperties } from './types';

export function Line2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Line2DProperties;

  // Geometry only depends on points + width.
  const geometry = useMemo(
    () => buildLineGeometry(props.points, props.width, props.closed),
    [props.points, props.width, props.closed]
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={(tint) => {
        if (!geometry) {
          return null;
        }
        return (
          <LineMesh geometry={geometry} tint={tint} color={props.defaultColor} />
        );
      }}
    >
      {children}
    </CanvasItem2D>
  );
}

function LineMesh({
  geometry,
  tint,
  color,
}: {
  geometry: THREE.BufferGeometry;
  tint: CanvasItemTint;
  color: Line2DProperties['defaultColor'];
}) {
  const { fill, opacity } = useMemo(() => {
    const composed = multiplyModulate(tint.own, color);
    return {
      fill: godotColorToLinear(composed),
      opacity: composed.a,
    };
  }, [tint.own, color]);

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        color={fill}
        opacity={opacity}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Build a poly-stroke `BufferGeometry` from the flat `[x0,y0,…]` outline. */
export function buildLineGeometry(
  points: Float32Array,
  width: number,
  closed: boolean
): THREE.BufferGeometry | null {
  const n = Math.floor(points.length / 2);
  if (n < 2) return null;

  const segs = n - 1;
  // One quad per segment + optional closing quad.
  const totalQuads = closed ? segs + 1 : segs;
  const positions = new Float32Array(totalQuads * 4 * 3);
  // Two triangles per quad (0,1,2 + 0,2,3). Without an index a 4-vertex quad
  // renders as a SINGLE triangle (half the ribbon), so the stroke MUST be indexed.
  const indices = new Uint32Array(totalQuads * 6);

  for (let q = 0; q < totalQuads; q++) {
    const closing = closed && q === segs; // the wrap-around segment: last point → first
    appendQuad(positions, points, closing ? (n - 1) * 2 : q * 2, width, closing, q * 12);
    const b = q * 4;
    indices.set([b, b + 1, b + 2, b, b + 2, b + 3], q * 6);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/** Write one quad around segment p_{pairStart/2} → p_{(pairStart+2)/2}. */
function appendQuad(
  positions: Float32Array,
  points: Float32Array,
  pairStart: number,
  width: number,
  fromLastToFirst: boolean,
  offset: number
): void {
  let x0: number, y0: number;
  let x1: number, y1: number;

  if (fromLastToFirst) {
    // Closing segment: last point → first point.
    const len = points.length;
    x0 = points[len - 2]!;
    y0 = points[len - 1]!;
    x1 = points[0]!;
    y1 = points[1]!;
  } else {
    x0 = points[pairStart]!;
    y0 = points[pairStart + 1]!;
    x1 = points[pairStart + 2]!;
    y1 = points[pairStart + 3]!;
  }

  // Convert to three-space: negate Godot's downward Y (three Y+ goes up).
  const gt_x0 = x0;
  const gt_y0 = -y0;
  const gt_x1 = x1;
  const gt_y1 = -y1;

  // Segment direction in three-space.
  const dx = gt_x1 - gt_x0;
  const dy = gt_y1 - gt_y0;
  const lenSq = dx * dx + dy * dy;

  let perpX = 0;
  let perpY = 0;

  if (lenSq >= 0.0001) {
    const len = Math.sqrt(lenSq);
    // Perpendicular to segment direction (counter-clockwise 90°).
    perpX = -dy / len;
    perpY = dx / len;
  }

  // Half-width offsets.
  const ohx = perpX * width * 0.5;
  const ohy = perpY * width * 0.5;

  // Vertices: (p₀−n·hw), (p₀+n·hw), (p₁+n·hw), (p₁−n·hw)
  positions[offset]       = gt_x0 - ohx;
  positions[offset + 1]   = gt_y0 - ohy;
  positions[offset + 2]   = 0;

  positions[offset + 3]   = gt_x0 + ohx;
  positions[offset + 4]   = gt_y0 + ohy;
  positions[offset + 5]   = 0;

  positions[offset + 6]   = gt_x1 + ohx;
  positions[offset + 7]   = gt_y1 + ohy;
  positions[offset + 8]   = 0;

  positions[offset + 9]   = gt_x1 - ohx;
  positions[offset + 10]  = gt_y1 - ohy;
  positions[offset + 11]  = 0;
}
