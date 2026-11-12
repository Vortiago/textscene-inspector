/**
 * <LightOccluder2D> draws its OccluderPolygon2D outline as a <GizmoLine> for every node
 * (`light_occluder_2d.cpp:183`, ADR-0056), and always publishes the segments, `cull_mode` and
 * `occluder_light_mask` to the shadow-caster registry, since Godot's occluders are
 * invisible and always cast. With no light pass mounted above, that is a no-op.
 */

import { useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useNodeResource } from '../../../resources/reading';
import { OCCLUDER_POLYGON_2D } from '../../../resources/shapes/occluderpolygon2d';
import { useGizmoDrawn } from '../../../r3f/hooks/useGizmoState';
import { useShadowCaster } from '../../../r3f/lighting2d/shadowCasterRegistry';
import type { LightOccluder2DProperties } from './types';
import { godotPolylineToSegments } from '../../../r3f/gizmo/godotPolylineToSegments';

export function LightOccluder2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as LightOccluder2DProperties;
  const drawsOutline = useGizmoDrawn('every-node');
  // A callback ref, not useRef, so the caster re-registers once the anchor exists:
  // an effect reading a ref would see null on the mount pass.
  const [anchor, setAnchor] = useState<THREE.Group | null>(null);

  const { value: occluder } = useNodeResource(properties.occluder, OCCLUDER_POLYGON_2D);

  // Flat `[x0,y0,x1,y1,...]`, which godotPolylineToSegments pairs and Y-negates.
  const positions = useMemo(
    () => (occluder ? godotPolylineToSegments(occluder.polygon, occluder.isClosed) : null),
    [occluder]
  );

  const caster = useMemo(
    () =>
      anchor && occluder && positions
        ? {
            segments: positions,
            cullMode: occluder.cullMode,
            occluderLightMask: properties.occluder_light_mask,
            object: anchor as THREE.Object3D,
          }
        : null,
    [anchor, positions, occluder, properties.occluder_light_mask]
  );
  useShadowCaster(caster);

  return (
    <CanvasItem2D
      node={node}
      props={properties}
      body={() => (
        <>
          {/* Empty anchor: carries no geometry, only the occluder's world matrix. */}
          {/* paint-order-safe: an empty anchor the shadow pass reads a world
              transform from. It draws nothing, so it orders nothing. */}
          <group ref={setAnchor} />
          {drawsOutline && positions ? <GizmoLine positions={positions} /> : null}
        </>
      )}
    >
      {children}
    </CanvasItem2D>
  );
}
