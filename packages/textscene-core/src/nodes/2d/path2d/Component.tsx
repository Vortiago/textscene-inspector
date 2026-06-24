/**
 * <Path2D> — a Node2D that holds a Curve2D. It resolves + tessellates the curve
 * and ALWAYS provides it to descendants via Path2DCurveProvider (so a
 * PathFollow2D child can follow it regardless of selection), and draws the curve
 * as a **selection-gated** white polyline gizmo (ADR-0018) — visible only while
 * this node is selected, mirroring Godot's 2D editor path line.
 *
 * The curve sampler stays in Path2D-local Godot space (+Y down); each curve
 * vertex (px, py) is drawn at three-local (px, -py) inside the conjugated
 * diag(1,-1,1) Node2D group, matching Polygon2D's Y-negation convention.
 *
 * Degrades gracefully: a missing curve, an ExtResource (.tres) curve, or a
 * SubResource that isn't found yields a null sampler → no gizmo, and children
 * fall back to their authored transform. Real scenes set the curve at runtime
 * via script (e.g. godot-open-rpg's gamepiece.tscn), so absence is normal.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { findSubResource, parseResourceReference } from '../../../resources/SubResourceResolver';
import {
  parseCurve2DPoints,
  tessellateCurve2D,
  type Curve2DSampler,
} from '../../../resources/shapes/curve2d';
import { Path2DCurveProvider } from '../../../r3f/contexts/Path2DCurveContext';
import type { Path2DProperties } from './types';

/** Godot editor path line color (white). */
const PATH_COLOR = 0xffffff;

export function Path2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Path2DProperties;
  const { internalResources } = useSceneResources();
  const gizmoVisible = useGizmoVisible();

  const sampler = useMemo<Curve2DSampler | null>(() => {
    if (!props.curve) return null;
    const ref = parseResourceReference(props.curve);
    // Only embedded SubResource Curve2D is resolved synchronously; an external
    // .tres curve would need the async resource pipeline (not used by real
    // scenes here) — degrade to null.
    if (!ref || ref.type !== 'SubResource') return null;
    const sub = findSubResource(internalResources, ref.id);
    if (!sub) return null;
    const points = parseCurve2DPoints(sub.data['_data']);
    if (points.length < 2) return null;
    return tessellateCurve2D(points);
  }, [props.curve, internalResources]);

  return (
    <Node2D node={node}>
      {gizmoVisible && sampler && <PathCurveGizmo sampler={sampler} />}
      <Path2DCurveProvider value={sampler}>{children}</Path2DCurveProvider>
    </Node2D>
  );
}

function PathCurveGizmo({ sampler }: { sampler: Curve2DSampler }) {
  const positions = useMemo(() => buildPolylineSegments(sampler.points), [sampler]);
  return <GizmoLine positions={positions} color={PATH_COLOR} />;
}

/**
 * Turn the flat Godot-space polyline `[x0,y0,x1,y1,…]` into LineSegments
 * vertex positions `(v0,v1),(v1,v2),…`, applying the +Y-down → three Y-negation.
 */
function buildPolylineSegments(points: number[]): Float32Array {
  const vertexCount = Math.floor(points.length / 2);
  const segCount = Math.max(0, vertexCount - 1);
  const positions = new Float32Array(segCount * 2 * 3);
  let o = 0;
  for (let i = 0; i + 1 < vertexCount; i++) {
    positions[o++] = points[i * 2]!;
    positions[o++] = -points[i * 2 + 1]!;
    positions[o++] = 0;
    positions[o++] = points[(i + 1) * 2]!;
    positions[o++] = -points[(i + 1) * 2 + 1]!;
    positions[o++] = 0;
  }
  return positions;
}
