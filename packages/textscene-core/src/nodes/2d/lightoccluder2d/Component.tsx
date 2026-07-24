/**
 * <LightOccluder2D> — a selection-gated occluder-outline gizmo.
 *
 * Reads the referenced OccluderPolygon2D resource, converts its `polygon`
 * (and `closed`) to line-segment positions, and renders them as a
 * <GizmoLine> inside <CanvasItem2D>. No-op when the node is unselected
 * or the resource is absent.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { parsePackedVector2Array } from '../../../resources/shapes/packedArray';
import type { LightOccluder2DProperties } from './types';
import { polygonToSegments } from './polygonShapes';

export function LightOccluder2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as LightOccluder2DProperties;
  const { internalResources, externalResources } = useSceneResources();
  const visible = useGizmoVisible();

  const occluderResource = useSubOrExtResource(
    properties.occluder, internalResources, externalResources
  );

  const positions = useMemo(() => {
    if (!occluderResource) return null;
    const data = occluderResource.data as Record<string, string>;
    if (!data.polygon) return null;
    const raw = parsePackedVector2Array(data.polygon);
    // raw is [x0,y0,x1,y1,...]; pair into points for polygonToSegments.
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      points.push({ x: raw[i]!, y: raw[i + 1]! });
    }
    const closed = data.closed !== 'false';
    return polygonToSegments(points, closed);
  }, [occluderResource]);

  if (!visible || !positions)
    return <CanvasItem2D node={node} props={properties} body={() => null}>{children}</CanvasItem2D>;

  return (
    <CanvasItem2D
      node={node}
      props={properties}
      body={() => <GizmoLine positions={positions} />}
    >
      {children}
    </CanvasItem2D>
  );
}
