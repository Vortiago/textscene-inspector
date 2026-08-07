/**
 * <Decal> — Godot's texture projector, rendered as a real projection.
 *
 * Godot projects `texture_albedo` down the node's local -Y axis onto whatever
 * surfaces sit inside an axis-aligned box of dimensions `size` (centred on the
 * origin), clips the texture to that box, and blends it onto the LIT surface.
 * We reproduce that with three's `DecalGeometry` (see `decalProjection.ts`):
 * after mount, we walk the live THREE scene for meshes the box touches and bake
 * a decal mesh onto each, in the decal's own local frame. The projections hang
 * under a plain (unscaled) group so they inherit only the decal's world
 * transform — `size` enters solely as the projector's box dimensions.
 *
 * Material: an unlit-albedo-over-a-lit-surface blend via `MeshStandardMaterial`
 * (so the projected texture is shaded by the same lights as the surface beneath
 * it, matching Godot). `albedo_mix × modulate.a` drives opacity — the stand-in
 * for "how strongly the albedo replaces the surface"; `modulate` tints it.
 *
 * Gizmo: Godot's editor outlines the projector box, but its RUNTIME (what our
 * reference renders) draws none — so the box wireframe is selection-gated via
 * `useGizmoVisible()` (ADR-0018), matching Marker3D/Path3D. An unselected decal
 * shows only its projection, exactly like Godot at runtime.
 *
 * Honoured: `texture_albedo`, `size`, `modulate`, `albedo_mix`. Parsed but not
 * yet projected: `cull_mask` (layer filtering), `upper_fade`/`lower_fade`/
 * `normal_fade`/`distance_fade_*`, and the normal/ORM/emission maps.
 *
 * Wraps `<Node3D>` so transform, visibility, and children come from the base.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { useLiveTreeVersion } from '../../../r3f/useLiveSceneTree';
import { useResourceLoader } from '../../../resources/useResource';
import { useTexture2D } from '../../../resources/useTexture2D';
import type { Color } from '../../../utils/colorParser';
import type { Vector3 } from '../../../parser/vectors';
import type { DecalProperties } from './types';
import {
  buildDecalProjectionGeometry,
  collectDecalReceivers,
  computeDecalBoxWorldAABB,
} from './decalProjection';

/** Wireframe colour for the (selection-gated) projection-box gizmo. */
const BOX_COLOR = '#ff9d3b';

export function Decal({ node, children }: NodeComponentProps) {
  const properties = node.properties as DecalProperties;
  const { externalResources, internalResources } = useSceneResources();
  const gizmoVisible = useGizmoVisible();

  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const resourceVersion = useLiveTreeVersion(useResourceLoader());
  const projectionRef = useRef<THREE.Group>(null);

  // Unit-cube projection-volume wireframe — `size` scales the gizmo group, so
  // animating `size` (ADR-0017) stays a cheap scale write. Handed to R3F via
  // `primitive`, which does NOT auto-dispose; release on unmount.
  const boxEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, []);
  useEffect(() => () => boxEdges.dispose(), [boxEdges]);

  // `useTexture2D`, not the path-only resolver: `texture_albedo` may name an
  // inline procedural texture, which is described entirely by the scene and
  // has no file to load. The projection material below borrows this texture as
  // its `map` and never disposes it — `Material.dispose()` releases the
  // material only — so the shared cache entry behind it stays valid for every
  // other consumer.
  const { texture: albedoTexture } = useTexture2D(
    properties.texture_albedo,
    externalResources,
    internalResources
  );
  const albedo = albedoTexture ?? null;

  // An active AnimationPlayer can drive `modulate` and `size` (ADR-0017); `null`
  // means none is, so the authored value shows. The projection maths is
  // identical for driven and authored values.
  const animatedModulate = useAnimatedValue<Color>('modulate', (v) => ({
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

  // Godot stores modulate in sRGB → linear for the shaded material tint.
  const color = useGodotLinearColor(modulate);
  // albedo_mix scales how strongly the projected albedo replaces the surface;
  // fold it with modulate alpha into the projection's opacity.
  const opacity = clamp01(properties.albedo_mix * modulate.a);

  // Build the projection meshes IMPERATIVELY (via the group ref, not React
  // state) so a scene-walk that mutates THREE objects can never feed a render
  // loop — the two-frame visual gate needs the output to converge. Re-runs when
  // the albedo, box, tint, or the live tree (async receiver loads) change.
  useEffect(() => {
    const group = projectionRef.current;
    if (!group || !albedo) return undefined;

    // World matrices may be stale in an effect (they refresh during the render
    // loop); force them current before reading the decal frame or walking.
    scene.updateMatrixWorld(true);
    const decalWorld = group.matrixWorld;
    const decalWorldInverse = decalWorld.clone().invert();
    const boxAABB = computeDecalBoxWorldAABB(decalWorld, size);
    const receivers = collectDecalReceivers(scene, boxAABB);

    const material = new THREE.MeshStandardMaterial({
      map: albedo,
      color,
      metalness: 0,
      roughness: 1,
      transparent: true,
      opacity,
      depthWrite: false,
      // Sit the projection ON the surface without z-fighting the coincident
      // receiver face.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    for (const receiver of receivers) {
      const geometry = buildDecalProjectionGeometry(receiver, decalWorldInverse, size);
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.isDecalProjection = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 3;
      // A projection is a visual overlay, not pickable geometry — let clicks
      // fall through to the surface beneath it (and never re-select via it).
      mesh.raycast = () => {};
      group.add(mesh);
    }

    invalidate();

    return () => {
      for (const child of group.children.slice()) {
        group.remove(child);
        (child as THREE.Mesh).geometry?.dispose();
      }
      material.dispose();
    };
    // `size` is the authored Vector3 (stable identity) unless an
    // AnimationPlayer is driving it, in which case a size keyframe rebuilds the
    // projection — acceptable for the rare animated-decal case.
  }, [scene, invalidate, albedo, color, opacity, size, resourceVersion]);

  return (
    <Node3D node={node}>
      {gizmoVisible && (
        <group scale={[size.x, size.y, size.z]}>
          <lineSegments userData={{ cullMask: properties.cull_mask }}>
            <primitive object={boxEdges} attach="geometry" />
            <lineBasicMaterial color={BOX_COLOR} transparent opacity={0.9} depthWrite={false} />
          </lineSegments>
        </group>
      )}
      {/* Projection meshes are attached here imperatively — an unscaled group so
          they inherit only the decal's world transform, not `size`. */}
      <group ref={projectionRef} />
      {children}
    </Node3D>
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
