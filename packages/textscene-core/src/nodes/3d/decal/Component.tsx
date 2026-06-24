/**
 * <Decal> — Godot's texture projector, visualised for the previewer.
 *
 * Godot projects `texture_albedo` down the node's local -Y axis onto surfaces
 * inside an axis-aligned box of dimensions `size`, centred on the origin. A
 * faithful projection would require rendering the texture onto whatever
 * geometry sits inside the box; for v1 we approximate that with two gizmos
 * that mirror Godot's editor:
 *   - A wireframe box outlining the projection volume — ALWAYS drawn, even
 *     without a texture, so the decal is visible/selectable in the viewport.
 *   - A horizontal textured quad (the albedo as seen looking down -Y) on the
 *     box's mid-plane — drawn only once `texture_albedo` resolves.
 *
 * Honoured properties: `texture_albedo`, `size`, `modulate`, `albedo_mix`.
 * `albedo_mix` × `modulate.a` drives the preview quad's opacity (a stand-in
 * for "how strongly the albedo replaces the surface"). `cull_mask` is parsed
 * and surfaced in the Inspector / `userData` but does not affect the preview.
 *
 * Wraps `<Node3D>` so the transform, visibility, and children are handled by
 * the base component (same composition as NavigationRegion3D).
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useAnimatedValueRegistry, type ValueSetter } from '../../../r3f/contexts/AnimatedValueContext';
import { resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import type { Color } from '../../../utils/colorParser';
import type { DecalProperties } from './types';

/** Wireframe colour for the projection-box gizmo. */
const BOX_COLOR = '#ff9d3b';

export function Decal({ node, children }: NodeComponentProps) {
  const properties = node.properties as DecalProperties;
  const { externalResources } = useSceneResources();

  const { x: sizeX, y: sizeY, z: sizeZ } = properties.size;

  // Projection-volume wireframe — built per-component and handed to R3F via
  // `primitive`, which it does NOT auto-dispose; release on size change/unmount.
  const boxEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [sizeX, sizeY, sizeZ]);
  useEffect(() => () => boxEdges.dispose(), [boxEdges]);

  // Resolve `texture_albedo = ExtResource("id")` → res:// path. Empty string
  // short-circuits useResource (its contract) so the hook count stays stable
  // whether or not an albedo texture is present.
  const texturePath = useMemo(
    () => resolveExtResourcePath(properties.texture_albedo, externalResources),
    [properties.texture_albedo, externalResources]
  );
  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');

  // An active AnimationPlayer can drive `modulate` (ADR-0017): register a setter
  // keyed by node path + `modulate` so the player can push the interpolated
  // colour; `null` releases it and the authored modulate shows again.
  const nodePath = useNodePath();
  const valueRegistry = useAnimatedValueRegistry();
  const [animatedModulate, setAnimatedModulate] = useState<Color | null>(null);
  useEffect(() => {
    if (nodePath === null) return;
    const setter: ValueSetter = (v) =>
      setAnimatedModulate(
        v === null ? null : { r: v[0] ?? 1, g: v[1] ?? 1, b: v[2] ?? 1, a: v[3] ?? 1 }
      );
    valueRegistry.register(nodePath, 'modulate', setter);
    return () => valueRegistry.unregister(nodePath, 'modulate', setter);
  }, [nodePath, valueRegistry]);

  // A driven modulate overrides the authored one; the rest of the pipeline
  // (sRGB→linear, opacity = albedo_mix × a) is identical either way.
  const modulate = animatedModulate ?? properties.modulate;

  // Godot stores modulate in sRGB → convert to the linear working space before
  // the unlit material (same as Sprite3D / Sprite2D).
  const color = useMemo(
    () => godotColorToLinear(modulate),
    [modulate.r, modulate.g, modulate.b]
  );

  // albedo_mix scales how strongly the projected albedo replaces the surface;
  // fold it together with modulate alpha into the preview quad's opacity.
  const opacity = clamp01(properties.albedo_mix * modulate.a);

  // Only the 'loaded' state yields a texture; pending/unavailable fall back to
  // the wireframe box alone (a Decal without a visible albedo is still valid).
  const albedo = texResult.value;

  return (
    <Node3D node={node}>
      <lineSegments renderOrder={2} userData={{ cullMask: properties.cull_mask }}>
        <primitive object={boxEdges} attach="geometry" />
        <lineBasicMaterial color={BOX_COLOR} transparent opacity={0.9} depthWrite={false} />
      </lineSegments>
      {albedo && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
          <planeGeometry args={[sizeX, sizeZ]} />
          <meshBasicMaterial
            map={albedo}
            color={color}
            transparent
            opacity={opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {children}
    </Node3D>
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
