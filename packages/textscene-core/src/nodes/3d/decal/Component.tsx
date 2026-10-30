/**
 * <Decal>: Godot's texture projector. It puts a decal into the scene at the node's transform, and
 * the scene's decals mix its textures into every surface its box holds, per fragment, as
 * Godot's clustered renderer does (`r3f/decal/sceneDecals.ts`), with its normal, ORM and emission
 * maps. Wraps `<Node3D>` for transform and children.
 */

import { useMemo } from 'react';
import { extend } from '@react-three/fiber';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { useTreeOrder } from '../../../r3f/contexts/TreeOrderContext';
import { PluginGizmo } from '../../../r3f/gizmo/PluginGizmo';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { DecalObject } from '../../../r3f/decal/decalObject';
import { useSceneDecals } from '../../../r3f/decal/useSceneDecals';
import { useHeldTexture } from '../../../r3f/textureAtlas/useHeldTexture';
import type { DecalProperties } from './types';
import { holdDecalTexture, releaseDecalTexture } from './decalAtlas';
import { decalGizmoLines } from './gizmoLines';
import type { Rgba } from '../../../godot/math/math';
import type { Vector3 } from '../../../godot/math/vector';

/** `editors/3d_gizmos/gizmo_colors/decal` (`editor_settings.cpp:884`). */
const GIZMO_COLOUR = godotColorToLinear({ r: 0.6, g: 0.5, b: 1 });

/** The gizmo of a unit box. `size` scales the gizmo group, so animating `size` stays a cheap scale write. */
const UNIT_BOX_LINES = decalGizmoLines({ x: 1, y: 1, z: 1 });

/** An element, not a `<primitive>`: it carries no material, and R3F sets its fields as props. */
const DecalElement = extend(DecalObject);

export function Decal({ node, children }: NodeComponentProps) {
  useSceneDecals();
  const treeOrder = useTreeOrder();
  const properties = node.properties as DecalProperties;
  const albedo = useDecalTexture(properties.texture_albedo);
  const normal = useDecalTexture(properties.texture_normal);
  const orm = useDecalTexture(properties.texture_orm);
  const emission = useDecalTexture(properties.texture_emission);
  const textures = useMemo(() => ({ albedo, normal, orm, emission }), [albedo, normal, orm, emission]);

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
      <DecalElement look={decal} textures={textures} treeOrder={treeOrder} />
      {/* Godot's editor draws the projector box for every decal, faint while it is not selected
          (`decal_gizmo_plugin.cpp:128`), and its runtime, which the reference renders, draws none. */}
      <PluginGizmo drawnFor="every-node">
        <group scale={[size.x, size.y, size.z]}>
          <GizmoLine positions={UNIT_BOX_LINES} color={GIZMO_COLOUR} />
        </group>
      </PluginGizmo>
      {children}
    </Node3D>
  );
}

/**
 * The texture that `reference` names, held in the decal atlas while this decal uses it
 * (`decal_set_texture`, `texture_storage.cpp:2944-2950`). Two decals with one texture share one
 * rectangle, and so do two maps of one decal. It resolves by RID, as `Decal::set_texture` passes it
 * (`scene/3d/decal.cpp:46`): an AtlasTexture projects its whole sheet, and a CanvasTexture, a RID
 * the atlas refuses (`texture_storage.cpp:2941`), projects nothing. The atlas copies the texture's
 * plain view (`texture_storage.cpp:3216`), so the shared cache entry is never bound or disposed.
 */
const useDecalTexture = (reference: string | undefined) =>
  useHeldTexture(reference, 'plain', holdDecalTexture, releaseDecalTexture);
