/**
 * <Polygon2D> — a filled convex/simple polygon in the 2D canvas. A CanvasItem2D
 * (carrying the Node2D transform + modulate ritual) whose body is a
 * `ShapeGeometry` built from the `polygon` PackedVector2Array. Each Godot-local
 * vertex (px, py) is placed at three-local (px, -py) inside the conjugated
 * (diag(1,-1,1)) Node2D group, matching Sprite2D's Y-negation convention.
 *
 * The fill is the flat `color` composited with the inherited modulate in sRGB
 * (via the tint's `own` product) and converted to linear once, then drawn with
 * an unlit, double-sided, alpha-blended material — Godot's 2D canvas model.
 *
 * Deferred (render-intent, not stubs): the `texture`/`uv` mapping, per-vertex
 * `vertex_colors`, and the `invert_enabled` border fill. These render as the
 * flat-colored, non-inverted polygon — correct in shape, placement, and tint —
 * rather than nothing; the texture only modulates the already-shown color.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { multiplyModulate, type CanvasItemTint } from '../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../r3f/godotColor';
import type { Vector2 } from '../../base/node2d/types';
import type { Polygon2DProperties } from './types';
import { polygonRings, type PolygonRings } from './polygonShapes';

export function Polygon2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Polygon2DProperties;

  // Geometry depends only on the rings + offset; the tint composites in body.
  const geometry = useMemo(
    () =>
      buildFilledPolygonGeometry(
        polygonRings(
          props.polygon,
          props.polygons,
          props.internalVertexCount,
          props.invertEnabled,
          props.invertBorder
        ),
        props.offset
      ),
    [
      props.polygon,
      props.polygons,
      props.internalVertexCount,
      props.invertEnabled,
      props.invertBorder,
      props.offset,
    ]
  );
  // R3F won't auto-dispose a geometry passed via `attach`; release on rebuild.
  useEffect(() => () => geometry?.dispose(), [geometry]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={(tint) =>
        geometry ? <FilledPolygon geometry={geometry} tint={tint} color={props.color} /> : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

function FilledPolygon({
  geometry,
  tint,
  color,
}: {
  geometry: THREE.ShapeGeometry;
  tint: CanvasItemTint;
  color: Polygon2DProperties['color'];
}) {
  // Godot multiplies fill × modulate × self_modulate in one space, then converts
  // once: compose with the tint's sRGB `own` product before sRGB→linear.
  const { fill, opacity } = useMemo(() => {
    const composed = multiplyModulate(tint.own, color);
    return { fill: godotColorToLinear(composed), opacity: composed.a };
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

/**
 * Build a filled `ShapeGeometry` from the resolved rings, applying the pixel
 * `offset` and the +Y-down → three Y-negation. No fillable ring → null.
 * Winding is irrelevant: the material is double-sided.
 *
 * `polygons` yields several independent shapes (Godot triangulates each entry
 * on its own); `invert_enabled` yields one shape with the polygon as a hole.
 * THREE.ShapeGeometry takes an array of shapes, so both fall out of the same
 * call.
 */
function buildFilledPolygonGeometry(
  rings: PolygonRings,
  offset: Vector2
): THREE.ShapeGeometry | null {
  if (rings.outlines.length === 0) return null;

  const shapes = rings.outlines.map((ring) => {
    const shape = new THREE.Shape(ring.map((p) => toThree(p, offset)));
    if (rings.hole) shape.holes.push(new THREE.Path(rings.hole.map((p) => toThree(p, offset))));
    return shape;
  });
  return new THREE.ShapeGeometry(shapes);
}

/** Godot pixel space (+Y down) → three's 2D plane, with `offset` applied. */
function toThree(p: Vector2, offset: Vector2): THREE.Vector2 {
  return new THREE.Vector2(p.x + offset.x, -(p.y + offset.y));
}
