/**
 * <Decal>: Godot's texture projector. It puts a decal into the scene at the node's transform, and
 * the scene's decals mix its `texture_albedo` into every surface its box holds, per fragment, as
 * Godot's clustered renderer does (`r3f/decal/sceneDecals.ts`). Wraps `<Node3D>` for transform and
 * children. Parsed but not yet projected: the normal/ORM/emission maps and `emission_energy`.
 */

import { useEffect, useMemo } from 'react';
import { extend } from '@react-three/fiber';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { useTreeOrder } from '../../../r3f/contexts/TreeOrderContext';
import { PluginGizmo } from '../../../r3f/gizmo/PluginGizmo';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { DecalObject } from '../../../r3f/decal/decalObject';
import { useSceneDecals } from '../../../r3f/decal/useSceneDecals';
import { useTexture2DRid } from '../../../resources/useTexture2D';
import type { DecalProperties } from './types';
import { holdDecalTexture, releaseDecalTexture } from './decalAtlas';
import { aabbEdges, centredAabb } from '../../../godot/math/aabb';
import type { Rgba } from '../../../godot/math/math';
import type { Vector3 } from '../../../godot/math/vector';

/** Wireframe colour and colour alpha of the projection-box gizmo. */
const BOX_COLOR = '#ff9d3b';
const BOX_ALPHA = 0.9;

/** The edges of a unit cube. `size` scales the gizmo group, so animating `size` stays a cheap scale write. */
const UNIT_BOX_EDGES = new Float32Array(aabbEdges(centredAabb({ x: 1, y: 1, z: 1 })));

/** An element, not a `<primitive>`: it carries no material, and R3F sets its fields as props. */
const DecalElement = extend(DecalObject);

export function Decal({ node, children }: NodeComponentProps) {
  useSceneDecals();
  const treeOrder = useTreeOrder();
  const properties = node.properties as DecalProperties;
  const { externalResources, internalResources } = useSceneResources();

  // By RID, as `Decal::set_texture` passes it (`scene/3d/decal.cpp:46`): an AtlasTexture projects
  // its whole sheet, and a CanvasTexture, a RID the decal atlas refuses (`texture_storage.cpp:2941`),
  // projects nothing. The decal atlas copies it, so the shared cache entry is never bound or disposed.
  const { texture: albedoTexture } = useTexture2DRid(
    properties.texture_albedo,
    externalResources,
    internalResources
  );
  const albedo = albedoTexture ?? null;

  // The decal atlas holds the texture while this decal projects it (`decal_set_texture`,
  // `texture_storage.cpp:2944-2950`), and two decals with one texture share one rectangle.
  useEffect(() => {
    if (!albedo) return undefined;
    holdDecalTexture(albedo);
    return () => releaseDecalTexture(albedo);
  }, [albedo]);

  // An active AnimationPlayer can drive `modulate` and `size` (ADR-0017); `null`
  // means none is, so the authored value shows.
  const animatedModulate = useAnimatedValue<Rgba>('modulate', (v) => ({
    r: v[0] ?? 1,
    g: v[1] ?? 1,
    b: v[2] ?? 1,
    a: v[3] ?? 1,
  }));
  const animatedSize = useAnimatedValue<Vector3>('size', (v) => ({
    x: v[0] ?? 0,
    y: v[1] ?? 0,
    z: v[2] ?? 0,
  }));
  const modulate = animatedModulate ?? properties.modulate;
  const size = animatedSize ?? properties.size;
  const decal = useMemo(() => ({ ...properties, modulate, size }), [properties, modulate, size]);

  return (
    <Node3D node={node}>
      <DecalElement decal={decal} albedo={albedo} treeOrder={treeOrder} />
      {/* Godot's editor outlines the projector box for every decal, faint while it is not selected
          (`decal_gizmo_plugin.cpp:128`), and its runtime, which the reference renders, draws none. */}
      <PluginGizmo drawnFor="every-node">
        <group scale={[size.x, size.y, size.z]}>
          <GizmoLine positions={UNIT_BOX_EDGES} color={BOX_COLOR} opacity={BOX_ALPHA} />
        </group>
      </PluginGizmo>
      {children}
    </Node3D>
  );
}
