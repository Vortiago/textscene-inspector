/**
 * <Decal>: Godot's texture projector, rendered as a real projection of `texture_albedo` down local
 * -Y, clipped to an origin-centred box of `size` and blended onto the lit surfaces inside it.
 * Wraps `<Node3D>` for transform, visibility and children. Parsed but not yet projected: the
 * normal/ORM/emission maps and `emission_energy`, which Godot's distance fade also scales.
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
import { applyTextureState, isMaterialOwnedTexture } from '../../../resources/textures/applyTextureState';
import type { Color } from '../../../utils/colorParser';
import type { Vector3 } from '../../../parser/vectors';
import type { DecalProperties } from './types';
import type { DecalGeometricFade } from './decalFade';
import { distanceFade } from '../../../godot/distanceFade';
import { cameraDistance, observeSceneCamera } from '../../../r3f/sceneRenderCamera';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import {
  buildDecalProjectionGeometry,
  collectDecalReceivers,
  computeDecalBoxWorldAABB,
} from './decalProjection';

/** Wireframe colour for the (selection-gated) projection-box gizmo. */
const BOX_COLOR = '#ff9d3b';

/** Literal-only, so the key is constant and the gizmo never remounts. */
const BOX_EDGES_MATERIAL = materialProgramInputs({
  props: { color: BOX_COLOR, transparent: true, opacity: 0.9, depthWrite: false },
});

export function Decal({ node, children }: NodeComponentProps) {
  const properties = node.properties as DecalProperties;
  const { externalResources, internalResources } = useSceneResources();
  // Godot's editor outlines the projector box but its runtime, which the reference renders, draws
  // none, so the wireframe is selection-gated (ADR-0018), as for Marker3D and Path3D.
  const gizmoVisible = useGizmoVisible();

  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const resourceVersion = useLiveTreeVersion(useResourceLoader());
  const projectionRef = useRef<THREE.Group>(null);
  // The projection material, for the per-frame distance-fade write below. It is
  // built imperatively inside the effect, so a ref is the only handle on it.
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Unit-cube projection-volume wireframe. `size` scales the gizmo group, so animating `size`
  // (ADR-0017) stays a cheap scale write. R3F's `primitive` does not auto-dispose, so this
  // releases it on unmount.
  const boxEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, []);
  useEffect(() => () => boxEdges.dispose(), [boxEdges]);

  // `useTexture2D`, not the path-only resolver: `texture_albedo` may name an inline procedural
  // texture with no file to load. The projection material samples it as `map` through the clamp
  // bind in the effect below: a cache entry that already clamps is reused untouched, and only a
  // bind-time clone is disposed with the material, so the shared entry stays valid for others.
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

  // Build the projection imperatively, through the group ref, not React state: walk the live
  // scene for meshes the box touches and bake a `DecalGeometry` mesh onto each in the decal's
  // local frame (`decalProjection.ts`). A scene-walk that mutates THREE objects then never feeds
  // a render loop, and the two-frame visual gate needs the output to converge.
  useEffect(() => {
    const group = projectionRef.current;
    if (!group || !albedo) return undefined;

    // World matrices may be stale in an effect (they refresh during the render
    // loop); force them current before reading the decal frame or walking.
    scene.updateMatrixWorld(true);
    const decalWorld = group.matrixWorld;
    const decalWorldInverse = decalWorld.clone().invert();
    const boxAABB = computeDecalBoxWorldAABB(decalWorld, size);
    // Godot's rule, `decal.cull_mask & instance.layers`, applies as the receivers are collected.
    const receivers = collectDecalReceivers(scene, boxAABB, properties.cull_mask);

    // Godot samples the decal through its clamped atlas: the blit uses REPEAT_DISABLED
    // (`copy_effects.cpp:592`) and fragments outside the box are discarded
    // (`scene_forward_clustered.glsl:1585-1587`). The consumer states clamp and never
    // inherits a Repeat from the shared producer.
    const projectionMap = applyTextureState(albedo, {
      repeat: false,
      colorSpace: THREE.SRGBColorSpace,
    });

    // Unlit albedo over a lit surface: the same lights shade the projection as the surface
    // beneath it, as in Godot.
    const material = new THREE.MeshStandardMaterial({
      map: projectionMap,
      color,
      metalness: 0,
      roughness: 1,
      transparent: true,
      opacity,
      // Godot's depth/normal fades ride the baked RGBA `color` attribute, whose RGB is 1, so only
      // alpha scales. three enables vertex alpha only at itemSize 4, and
      // `buildDecalProjectionGeometry` always writes the attribute, so no geometry lacks one,
      // which would sample the material default instead of skipping the fade.
      vertexColors: true,
      depthWrite: false,
      // Sit the projection on the surface without z-fighting the coincident
      // receiver face.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    materialRef.current = material;

    // The upper, lower and normal fades bake per vertex into the `color` attribute (`decalFade.ts`).
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
      // A projection is a visual overlay, not pickable geometry: clicks fall through to the
      // surface beneath it and never re-select through it.
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
      // Only a bind-time clone is this projection's to free; a shared cache entry is not.
      if (isMaterialOwnedTexture(projectionMap)) projectionMap.dispose();
    };
    // `size` is the authored Vector3 (stable identity) unless an
    // AnimationPlayer is driving it, in which case a size keyframe rebuilds the
    // projection, acceptable for the rare animated-decal case.
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

  // Distance fade is the one term Godot computes per decal per render, not per fragment:
  // `update_decal_buffer` measures the rendering camera's distance to the decal's origin, culls past
  // `begin + length` and folds the rest into modulate alpha. An opacity write before each render
  // mirrors it with no shader and no rebuild, for whichever camera renders the scene.
  const {
    distance_fade_enabled: fades,
    distance_fade_begin: fadeBegin,
    distance_fade_length: fadeLength,
  } = properties;
  useEffect(() => {
    const group = projectionRef.current;
    if (!fades || !group) return undefined;
    const stop = observeSceneCamera(scene, (camera) => {
      const material = materialRef.current;
      if (!material) return;
      showFaded(group, material, opacity, distanceFade(fadeBegin, fadeLength, cameraDistance(group, camera)));
    });
    return () => {
      stop();
      // A decal faded or hidden by an earlier render stays so unless the end of the fade restores
      // it. A rebuild that ends the fade too has already dropped the material, and builds its next
      // one unfaded, but the group outlives it.
      group.visible = true;
      if (materialRef.current) materialRef.current.opacity = opacity;
    };
  }, [scene, fades, fadeBegin, fadeLength, opacity]);

  return (
    <Node3D node={node}>
      {gizmoVisible && (
        <group scale={[size.x, size.y, size.z]}>
          <lineSegments userData={{ cullMask: properties.cull_mask }}>
            <primitive object={boxEdges} attach="geometry" />
            <lineBasicMaterial key={BOX_EDGES_MATERIAL.key} {...BOX_EDGES_MATERIAL.props} />
          </lineSegments>
        </group>
      )}
      {/* Projection meshes attach here imperatively, to an unscaled group, so
          they inherit only the decal's world transform, not `size`. */}
      <group ref={projectionRef} />
      {children}
    </Node3D>
  );
}

/** Folds `fade` into the decal's opacity. Godot drops a fully faded decal, and so does the group. */
function showFaded(group: THREE.Group, material: THREE.Material, opacity: number, fade: number): void {
  material.opacity = opacity * fade;
  group.visible = fade > 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
