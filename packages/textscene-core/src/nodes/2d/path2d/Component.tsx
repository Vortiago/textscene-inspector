/**
 * Draws a Path2D: it tessellates its Curve2D, always provides it to descendants
 * so a PathFollow2D child follows it, and draws it as a white polyline gizmo for every node, in full
 * colour (`path_2d.cpp:148`, ADR-0056), as Godot's 2D editor does.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { godotPolylineToSegments } from '../../../r3f/gizmo/godotPolylineToSegments';
import { useGizmoDrawn } from '../../../r3f/hooks/useGizmoState';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { resolveCurve2D, tessellateCurve2D, type Curve2DSampler } from '../../../resources/curves/curve2d';
import { Path2DCurveProvider } from '../../../r3f/contexts/Path2DCurveContext';
import type { Path2DProperties } from './types';

/** Godot editor path line color (white). */
const PATH_COLOR = 0xffffff;

export function Path2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Path2DProperties;
  const { internalResources } = useSceneResources();
  const drawsCurve = useGizmoDrawn('every-node');

  const sampler = useMemo<Curve2DSampler | null>(() => {
    // Only an embedded SubResource Curve2D resolves synchronously. Any other
    // curve gives a null sampler: no gizmo, and children keep their authored
    // transform. A script often sets the curve at runtime, so absence is normal.
    const points = resolveCurve2D(props.curve, internalResources);
    if (points.length < 2) return null;
    return tessellateCurve2D(points);
  }, [props.curve, internalResources]);

  return (
    <Node2D node={node}>
      {drawsCurve && sampler && <PathCurveGizmo sampler={sampler} />}
      <Path2DCurveProvider value={sampler}>{children}</Path2DCurveProvider>
    </Node2D>
  );
}

function PathCurveGizmo({ sampler }: { sampler: Curve2DSampler }) {
  const positions = useMemo(() => godotPolylineToSegments(sampler.points, false), [sampler]);
  return positions && <GizmoLine positions={positions} color={PATH_COLOR} />;
}
