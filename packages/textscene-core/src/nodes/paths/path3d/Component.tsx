/**
 * <Path3D> — a Node3D that holds a Curve3D. It resolves + tessellates the curve
 * and ALWAYS provides it to descendants via Path3DCurveProvider (so a
 * PathFollow3D child can follow it regardless of selection), and draws the curve
 * as a **selection-gated** white polyline gizmo (ADR-0018) — visible only while
 * this node is selected, mirroring Godot's 3D editor path line.
 *
 * Godot 3D space maps directly to three.js (right-handed Y-up), so curve points
 * are used as-is (no conjugation, unlike the 2D twin).
 *
 * Degrades gracefully: a missing curve, an ExtResource (.tres) curve, or a
 * SubResource that isn't found yields a null sampler → no gizmo, and children
 * fall back to their authored transform.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { findSubResource, parseResourceReference } from '../../../resources/SubResourceResolver';
import {
  parseCurve3DPoints,
  tessellateCurve3D,
  type Curve3DSampler,
} from '../../../resources/shapes/curve3d';
import { Path3DCurveProvider } from '../../../r3f/contexts/Path3DCurveContext';
import type { Path3DProperties } from './types';

/** Godot editor path line color (white). */
const PATH_COLOR = 0xffffff;

export function Path3D({ node, children }: NodeComponentProps) {
  const props = node.properties as Path3DProperties;
  const { internalResources } = useSceneResources();
  const gizmoVisible = useGizmoVisible();

  const sampler = useMemo<Curve3DSampler | null>(() => {
    if (!props.curve) return null;
    const ref = parseResourceReference(props.curve);
    if (!ref || ref.type !== 'SubResource') return null;
    const sub = findSubResource(internalResources, ref.id);
    if (!sub) return null;
    const points = parseCurve3DPoints(sub.data['_data']);
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
  const geometry = useMemo(() => buildPolylineSegments(sampler.points), [sampler]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments renderOrder={10}>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={PATH_COLOR} depthWrite={false} transparent />
    </lineSegments>
  );
}

/** Turn the flat polyline `[x0,y0,z0,…]` into LineSegments position pairs. */
function buildPolylineSegments(points: number[]): THREE.BufferGeometry {
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
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return g;
}
