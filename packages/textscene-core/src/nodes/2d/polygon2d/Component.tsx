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

export function Polygon2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Polygon2DProperties;

  // Geometry depends only on the outline + offset; the tint composites in body.
  const geometry = useMemo(
    () => buildFilledPolygonGeometry(props.polygon, props.offset),
    [props.polygon, props.offset]
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
  const composed = useMemo(() => multiplyModulate(tint.own, color), [tint.own, color]);
  const linear = useMemo(() => godotColorToLinear(composed), [composed]);

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        color={linear}
        opacity={composed.a}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Build a filled `ShapeGeometry` from the flat `[x0,y0,…]` outline, applying the
 * pixel `offset` and the +Y-down → three Y-negation. Fewer than 3 vertices is
 * degenerate (nothing to fill) → null. Winding is irrelevant: the material is
 * double-sided.
 */
function buildFilledPolygonGeometry(
  polygon: Float32Array,
  offset: Vector2
): THREE.ShapeGeometry | null {
  const n = Math.floor(polygon.length / 2);
  if (n < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(polygon[0]! + offset.x, -(polygon[1]! + offset.y));
  for (let i = 1; i < n; i++) {
    shape.lineTo(polygon[2 * i]! + offset.x, -(polygon[2 * i + 1]! + offset.y));
  }
  return new THREE.ShapeGeometry(shape);
}
