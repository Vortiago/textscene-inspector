/**
 * <LightOccluder2D> — a selection-gated occluder-outline gizmo that also
 * publishes its polygon to the 2D light pass.
 *
 * Reads the referenced OccluderPolygon2D resource, converts its `polygon`
 * (and `closed`) to line-segment positions, and renders them as a
 * <GizmoLine> inside <CanvasItem2D>. No-op when the node is unselected
 * or the resource is absent.
 *
 * The same segments — plus `cull_mode` and `occluder_light_mask` — go into the
 * shadow-caster registry, keyed to an anchor <group> so the pass can read the
 * occluder's world transform at draw time. Registration is unconditional on
 * selection (Godot's occluders are invisible and always cast) and a silent
 * no-op when no light pass is mounted above.
 */

import { useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { warn } from '../../../logger';
import { parsePackedVector2Array } from '../../../resources/shapes/packedArray';
import { useShadowCaster } from '../../../r3f/lighting2d/shadowCasterRegistry';
import { OCCLUDER_CULL_DISABLED } from '../../../r3f/lighting2d/shadowVolumes';
import type { LightOccluder2DProperties } from './types';
import { parseOccluderCullMode, polygonToSegments } from './polygonShapes';

export function LightOccluder2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as LightOccluder2DProperties;
  const { internalResources, externalResources } = useSceneResources();
  const visible = useGizmoVisible();
  // A callback ref (not useRef) so the caster re-registers once the anchor
  // exists — an effect reading a ref would see null on the mount pass.
  const [anchor, setAnchor] = useState<THREE.Group | null>(null);

  const occluderResource = useSubOrExtResource(
    properties.occluder, internalResources, externalResources
  );

  const positions = useMemo(() => {
    if (!occluderResource) return null;
    const data = occluderResource.data as Record<string, string>;
    if (!data.polygon) return null;
    // Flat `[x0,y0,x1,y1,...]`; polygonToSegments pairs and Y-negates it, and
    // ignores a dangling odd coordinate.
    // Guarded like every other caller: a malformed literal is the linter's to
    // report, not a throw through render.
    let raw: Float32Array;
    try {
      raw = parsePackedVector2Array(data.polygon);
    } catch {
      warn(`[LightOccluder2D] unreadable occluder polygon: ${data.polygon}`);
      return null;
    }
    const closed = data.closed !== 'false';
    return polygonToSegments(raw, closed);
  }, [occluderResource]);

  const cullMode = useMemo(
    () =>
      occluderResource
        ? parseOccluderCullMode((occluderResource.data as Record<string, string>).cull_mode)
        : OCCLUDER_CULL_DISABLED,
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
          <group ref={setAnchor} />
          {visible && positions ? <GizmoLine positions={positions} /> : null}
        </>
      )}
    >
      {children}
    </CanvasItem2D>
  );
}
