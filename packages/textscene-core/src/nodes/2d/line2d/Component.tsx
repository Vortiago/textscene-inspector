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
import { canvasItemBlendState, type CanvasItemBlendState } from '../../../resources/materials/canvasitemmaterial/renderer';
import { CanvasItemBlendMode } from '../../../resources/materials/canvasitemmaterial/types';
import { multiplyModulate, type CanvasItemTint } from '../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../r3f/godotColor';
import type { Line2DProperties } from './types';
import { jointWedge, LINE_JOINT_SHARP, type JointOptions } from './lineJoints';

export function Line2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Line2DProperties;

  // Geometry depends on the outline, its width, and the corner style.
  const geometry = useMemo(
    () =>
      buildLineGeometry(props.points, props.width, props.closed, {
        jointMode: props.jointMode,
        sharpLimit: props.sharpLimit,
        roundPrecision: props.roundPrecision,
      }),
    [
      props.points,
      props.width,
      props.closed,
      props.jointMode,
      props.sharpLimit,
      props.roundPrecision,
    ]
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={(tint, material) => {
        if (!geometry) {
          return null;
        }
        return (
          <LineMesh
            geometry={geometry}
            tint={tint}
            color={props.defaultColor}
            blend={canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX)}
          />
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
  blend,
}: {
  geometry: THREE.BufferGeometry;
  tint: CanvasItemTint;
  color: Line2DProperties['defaultColor'];
  blend: CanvasItemBlendState;
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
        {...blend}
      />
    </mesh>
  );
}

/**
 * Build a poly-stroke `BufferGeometry` from the flat `[x0,y0,…]` outline.
 *
 * One quad per segment plus a JOINT WEDGE at every interior corner: the quads
 * are butt-capped and independent, so without the wedges the outside of each
 * corner is an empty pie slice and the line reads as a chain of bars. Godot has
 * no "no joint" mode (`joint_mode` defaults to LINE_JOINT_SHARP), so the wedge
 * is not optional — see `lineJoints.ts` for the three modes.
 */
export function buildLineGeometry(
  points: Float32Array,
  width: number,
  closed: boolean,
  joints: JointOptions = DEFAULT_JOINTS
): THREE.BufferGeometry | null {
  const n = Math.floor(points.length / 2);
  if (n < 2) return null;

  const segs = n - 1;
  // One quad per segment + optional closing quad.
  const totalQuads = closed ? segs + 1 : segs;
  const positions = new Float32Array(totalQuads * 4 * 3);
  // Two triangles per quad (0,1,2 + 0,2,3). Without an index a 4-vertex quad
  // renders as a SINGLE triangle (half the ribbon), so the stroke MUST be indexed.
  const indices: number[] = [];

  for (let q = 0; q < totalQuads; q++) {
    const closing = closed && q === segs; // the wrap-around segment: last point → first
    appendQuad(positions, points, closing ? (n - 1) * 2 : q * 2, width, closing, q * 12);
    const b = q * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  // Wedges are self-contained triangles appended after the quads, so they carry
  // their own vertices and indices rather than sharing the quads'.
  const wedges = jointWedges(points, width * 0.5, closed, joints);
  const vertices = new Float32Array(positions.length + wedges.length);
  vertices.set(positions, 0);
  vertices.set(wedges, positions.length);
  const wedgeBase = totalQuads * 4;
  for (let i = 0; i < wedges.length / 3; i++) indices.push(wedgeBase + i);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  return geo;
}

/** Godot's own joint defaults, for callers that do not carry the properties. */
const DEFAULT_JOINTS: JointOptions = {
  jointMode: LINE_JOINT_SHARP,
  sharpLimit: 2,
  roundPrecision: 8,
};

/** Every interior corner's wedge, flattened. Godot's Y is negated here too. */
function jointWedges(
  points: Float32Array,
  halfWidth: number,
  closed: boolean,
  joints: JointOptions
): number[] {
  const n = Math.floor(points.length / 2);
  if (n < 3) return [];
  const at = (i: number) => ({ x: points[i * 2]!, y: -points[i * 2 + 1]! });

  const out: number[] = [];
  // Interior corners; a closed line also turns at its first and last points.
  const first = closed ? 0 : 1;
  const last = closed ? n - 1 : n - 2;
  for (let i = first; i <= last; i++) {
    const prev = at((i - 1 + n) % n);
    const next = at((i + 1) % n);
    out.push(...jointWedge(prev, at(i), next, halfWidth, joints));
  }
  return out;
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
