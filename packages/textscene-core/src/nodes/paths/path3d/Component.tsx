/**
 * <Path3D>: a Node3D that holds a Curve3D. It always provides the tessellated curve through
 * Path3DCurveProvider, so a PathFollow3D child follows it whatever the selection. It draws the
 * curve as a white polyline gizmo only while selected, like Godot's 3D editor (ADR-0018).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import {
  resolveCurve3D,
  tessellateCurve3D,
  type Curve3DSampler,
} from '../../../resources/curves/curve3d';
import { Path3DCurveProvider } from '../../../r3f/contexts/Path3DCurveContext';
import type { Path3DProperties } from './types';

/** Godot editor path line colour. */
const PATH_COLOR = 0xffffff;

export function Path3D({ node, children }: NodeComponentProps) {
  const props = node.properties as Path3DProperties;
  const { internalResources } = useSceneResources();
  const gizmoVisible = useGizmoVisible();

  // Godot 3D space is three.js space (right-handed Y-up), so curve points need no conjugation,
  // unlike the 2D twin. A missing, ExtResource (.tres) or unfound curve gives a null sampler:
  // no gizmo, and children keep their authored transform.
  const sampler = useMemo<Curve3DSampler | null>(() => {
    const points = resolveCurve3D(props.curve, internalResources);
    if (points.length < 2) return null;
    return tessellateCurve3D(points);
  }, [props.curve, internalResources]);

  return (
    <Node3D node={node}>
      {gizmoVisible && sampler && <PathCurveGizmo sampler={sampler} />}
      <Path3DCurveProvider value={sampler}>{children}</Path3DCurveProvider>
    </Node3D>
  );
}

function PathCurveGizmo({ sampler }: { sampler: Curve3DSampler }) {
  const positions = useMemo(() => buildPolylineSegments(sampler.points), [sampler]);
  return <GizmoLine positions={positions} color={PATH_COLOR} />;
}

/** Turn the flat polyline `[x0,y0,z0,…]` into LineSegments vertex position pairs. */
function buildPolylineSegments(points: number[]): Float32Array {
  const vertexCount = Math.floor(points.length / 3);
  const segCount = Math.max(0, vertexCount - 1);
  const positions = new Float32Array(segCount * 2 * 3);
  let o = 0;
  for (let i = 0; i + 1 < vertexCount; i++) {
    positions[o++] = points[i * 3]!;
    positions[o++] = points[i * 3 + 1]!;
    positions[o++] = points[i * 3 + 2]!;
    positions[o++] = points[(i + 1) * 3]!;
    positions[o++] = points[(i + 1) * 3 + 1]!;
    positions[o++] = points[(i + 1) * 3 + 2]!;
  }
  return positions;
}
