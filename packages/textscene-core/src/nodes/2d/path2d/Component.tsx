/**
 * Draws a Path2D: it tessellates its Curve2D, always provides it to descendants
 * so a PathFollow2D child follows it, and draws it as a selection-gated white
 * polyline gizmo (ADR-0018), as Godot's 2D editor does.
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
} from '../../../resources/curves/curve2d';
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
    // Only an embedded SubResource Curve2D resolves synchronously. Any other
    // curve gives a null sampler: no gizmo, and children keep their authored
    // transform. A script often sets the curve at runtime, so absence is normal.
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
 * Turns the flat Godot-space polyline `[x0,y0,x1,y1,…]` into LineSegments
 * positions `(v0,v1),(v1,v2),…`, negating Y inside the Node2D group.
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
