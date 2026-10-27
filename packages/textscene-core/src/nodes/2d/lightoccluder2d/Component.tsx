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
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { useGizmoDrawn } from '../../../r3f/hooks/useGizmoState';
import { warn } from '../../../logger';
import { parsePackedVector2Array } from '../../../resources/shapes/packedArray';
import { useShadowCaster } from '../../../r3f/lighting2d/shadowCasterRegistry';
import { OccluderPolygon2DCullMode } from '../../../godot/scene/lightOccluder2d';
import type { LightOccluder2DProperties } from './types';
import { parseOccluderCullMode } from './polygonShapes';
import { godotPolylineToSegments } from '../../../r3f/gizmo/godotPolylineToSegments';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';

export function LightOccluder2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as LightOccluder2DProperties;
  const sceneResources = useSceneResources();
  const drawsOutline = useGizmoDrawn('every-node');
  // A callback ref, not useRef, so the caster re-registers once the anchor exists:
  // an effect reading a ref would see null on the mount pass.
  const [anchor, setAnchor] = useState<THREE.Group | null>(null);

  const occluderResource = useSubOrExtResource(properties.occluder, sceneResources)?.resource;

  const positions = useMemo(() => {
    if (!occluderResource) return null;
    const data = occluderResource.data;
    if (!data.polygon) return null;
    // Flat `[x0,y0,x1,y1,...]`, which godotPolylineToSegments pairs and Y-negates. A
    // malformed literal is the linter's to report, not a throw through render.
    let raw: Float32Array;
    try {
      raw = parsePackedVector2Array(data.polygon);
    } catch {
      warn(`[LightOccluder2D] unreadable occluder polygon: ${data.polygon}`);
      return null;
    }
    const closed = boolSlotValue(data.closed) !== false;
    return godotPolylineToSegments(raw, closed);
  }, [occluderResource]);

  const cullMode = useMemo(
    () =>
      occluderResource
        ? parseOccluderCullMode(occluderResource.data.cull_mode)
        : OccluderPolygon2DCullMode.DISABLED,
    [occluderResource]
  );

  const caster = useMemo(
    () =>
      anchor && positions
        ? {
            segments: positions,
            cullMode,
            occluderLightMask: properties.occluder_light_mask,
            object: anchor as THREE.Object3D,
          }
        : null,
    [anchor, positions, cullMode, properties.occluder_light_mask]
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
