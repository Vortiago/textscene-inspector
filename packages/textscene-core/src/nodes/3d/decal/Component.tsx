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
 * Honoured: `texture_albedo`, `size`, `modulate`, `albedo_mix`, `cull_mask` —
 * Godot's exact rule, `decal.cull_mask & instance.layers`, applied when the
 * receivers are collected (`decalProjection.ts`) — and all four fades. The two
 * geometric ones bake per vertex into the projection's `color` attribute
 * (`decalFade.ts`); `distance_fade_*` is a per-frame `opacity` write, because
 * Godot computes it per decal on the CPU rather than per fragment.
 *
 * Parsed but not yet projected: the normal/ORM/emission maps and
 * `emission_energy`. (Godot's distance fade scales `emission_energy` alongside
 * modulate alpha; irrelevant until emission is wired.)
 *
 * Wraps `<Node3D>` so transform, visibility, and children come from the base.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { useLiveTreeVersion } from '../../../r3f/useLiveSceneTree';
import { resolveTexture2DPath } from '../../../resources/SubResourceResolver';
import { useResource, useResourceLoader } from '../../../resources/useResource';
import type { Color } from '../../../utils/colorParser';
import type { Vector3 } from '../../../parser/vectors';
import type { DecalProperties } from './types';
import { decalDistanceFade, type DecalGeometricFade } from './decalFade';
import {
  buildDecalProjectionGeometry,
  collectDecalReceivers,
  computeDecalBoxWorldAABB,
} from './decalProjection';

/** Wireframe colour for the (selection-gated) projection-box gizmo. */
const BOX_COLOR = '#ff9d3b';

/**
 * Scratch vectors for the distance-fade frame callback, so it allocates
 * nothing. Module scope rather than per instance: `useFrame` callbacks are
 * synchronous and never interleave, and a scene can carry dozens of decals.
 */
const decalOrigin = new THREE.Vector3();
const cameraOrigin = new THREE.Vector3();

export function Decal({ node, children }: NodeComponentProps) {
  const properties = node.properties as DecalProperties;
  const { externalResources, internalResources } = useSceneResources();
  const gizmoVisible = useGizmoVisible();

  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const resourceVersion = useLiveTreeVersion(useResourceLoader());
  const projectionRef = useRef<THREE.Group>(null);
  // The projection material, for the per-frame distance-fade write below. It is
  // built imperatively inside the effect, so a ref is the only handle on it.
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

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

  // Resolve `texture_albedo = ExtResource("id")` → res:// path. Empty string
  // short-circuits useResource (its contract) so the hook count stays stable
  // whether or not an albedo texture is present.
  const texturePath = useMemo(
    () => resolveTexture2DPath(properties.texture_albedo, externalResources, internalResources),
    [properties.texture_albedo, externalResources, internalResources]
  );
  const texResult = useResource<THREE.Texture>(texturePath ?? '', 'Texture2D');
  const albedo = texResult.value ?? null;

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
    const receivers = collectDecalReceivers(scene, boxAABB, properties.cull_mask);

    const material = new THREE.MeshStandardMaterial({
      map: albedo,
      color,
      metalness: 0,
      roughness: 1,
      transparent: true,
      opacity,
      // Godot's depth/normal fades ride the baked RGBA `color` attribute, whose
      // RGB is 1 so only alpha is scaled. three enables vertex ALPHA only at
      // itemSize 4; `buildDecalProjectionGeometry` always writes the attribute,
      // so this flag can never meet a geometry without one (which would sample
      // black rather than merely skip the fade).
      vertexColors: true,
      depthWrite: false,
      // Sit the projection ON the surface without z-fighting the coincident
      // receiver face.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    materialRef.current = material;

    const fade: DecalGeometricFade = {
      upperFade: properties.upper_fade,
      lowerFade: properties.lower_fade,
      normalFade: properties.normal_fade,
    };

    for (const receiver of receivers) {
      const geometry = buildDecalProjectionGeometry(receiver, decalWorldInverse, size, fade);
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
      materialRef.current = null;
      material.dispose();
    };
    // `size` is the authored Vector3 (stable identity) unless an
    // AnimationPlayer is driving it, in which case a size keyframe rebuilds the
    // projection — acceptable for the rare animated-decal case.
  }, [
    scene,
    invalidate,
    albedo,
    color,
    opacity,
    size,
    properties.cull_mask,
    properties.upper_fade,
    properties.lower_fade,
    properties.normal_fade,
    resourceVersion,
  ]);

  // Distance fade is the one term Godot computes per DECAL per frame rather
  // than per fragment: `update_decal_buffer` measures camera-to-decal-origin,
  // culls anything past `begin + length`, and folds the rest into the decal's
  // modulate alpha. Mirroring it as an opacity write means no shader and no
  // rebuild — the projection geometry is untouched. Hooks cannot be conditional,
  // so the enabled test is the guard inside, not around, the callback.
  useFrame((state) => {
    const group = projectionRef.current;
    const material = materialRef.current;
    if (!group || !material || !properties.distance_fade_enabled) return;

    // Both ends read the same way — straight off `matrixWorld`, no update
    // forced. `getWorldPosition` would call `updateWorldMatrix` first, ~20x the
    // cost, and buy no extra consistency since the decal end is a raw read.
    decalOrigin.setFromMatrixPosition(group.matrixWorld);
    cameraOrigin.setFromMatrixPosition(state.camera.matrixWorld);
    const fade = decalDistanceFade(
      properties.distance_fade_begin,
      properties.distance_fade_length,
      cameraOrigin.distanceTo(decalOrigin)
    );

    const next = opacity * fade;
    if (material.opacity !== next) {
      material.opacity = next;
      invalidate();
    }
    // A fully faded decal is dropped from Godot's buffer outright; hiding the
    // group is the same picture and skips the draw.
    const visible = fade > 0;
    if (group.visible !== visible) group.visible = visible;
  });

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
