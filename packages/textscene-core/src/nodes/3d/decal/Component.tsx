/**
 * <Decal>: Godot's texture projector, rendered as a real projection of `texture_albedo` down local
 * -Y, clipped to an origin-centred box of `size` and blended onto the lit surfaces inside it.
 * Wraps `<Node3D>` for transform and children. Parsed but not yet projected: the
 * normal/ORM/emission maps and `emission_energy`, which Godot's distance fade also scales.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useAnimatedValue } from '../../../r3f/contexts/AnimatedValueContext';
import { PluginGizmo } from '../../../r3f/gizmo/PluginGizmo';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useLiveTreeVersion } from '../../../r3f/useLiveSceneTree';
import { useResourceLoader } from '../../../resources/useResource';
import { useTexture2DRid } from '../../../resources/useTexture2D';
import { applyTextureState, releaseBoundTexture } from '../../../resources/textures/applyTextureState';
import type { DecalProperties } from './types';
import type { DecalGeometricFade } from './decalFade';
import { distanceFade } from '../../../godot/rendering/distanceFade';
import { TrackedObjects } from '../../../r3f/trackedObjects';
import { cameraDistance, observeSceneCamera } from '../../../r3f/sceneRenderCamera';
import { DecalProjectionMaterials, type DecalProjectionLook } from './decalProjectionMaterials';
import {
  buildDecalProjectionGeometry,
  collectDecalReceivers,
  computeDecalBoxWorldAABB,
} from './decalProjection';
import { aabbEdges, centredAabb } from '../../../godot/math/aabb';
import { clamp } from '../../../godot/math/math';
import type { Rgba } from '../../../godot/math/math';
import type { Vector3 } from '../../../godot/math/vector';
import { sameElements } from '../../../utils/sameElements';

/** Wireframe colour and colour alpha of the projection-box gizmo. */
const BOX_COLOR = '#ff9d3b';
const BOX_ALPHA = 0.9;

/** The edges of a unit cube. `size` scales the gizmo group, so animating `size` stays a cheap scale write. */
const UNIT_BOX_EDGES = new Float32Array(aabbEdges(centredAabb({ x: 1, y: 1, z: 1 })));

export function Decal({ node, children }: NodeComponentProps) {
  const properties = node.properties as DecalProperties;
  const { externalResources, internalResources } = useSceneResources();

  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const resourceVersion = useLiveTreeVersion(useResourceLoader());
  const projectionRef = useRef<THREE.Group>(null);
  // The projection materials, for the per-frame distance-fade write below. They are
  // built imperatively inside the effect, so a ref is the only handle on them.
  const materialsRef = useRef<DecalProjectionMaterials | null>(null);
  // What the last bake projected onto, and the mesh tracker's version then. Written by the bake
  // effect, cleared when it is torn down.
  const bakedRef = useRef<{ receivers: readonly THREE.Mesh[]; meshVersion: number } | null>(null);
  const meshesRef = useRef<TrackedObjects<THREE.Mesh> | null>(null);
  // Counts the bakes a late receiver asked for. It only changes the bake effect's dependencies.
  const [lateReceiverBakes, setLateReceiverBakes] = useState(0);

  // By RID, as `Decal::set_texture` passes it (`scene/3d/decal.cpp:46`): an AtlasTexture projects
  // its whole sheet, and a CanvasTexture, a RID the decal atlas refuses (`texture_storage.cpp:2941`),
  // projects nothing. The projection material samples it as `map` through the clamp bind below: a
  // cache entry that already clamps is reused untouched, and only a bind-time clone is disposed.
  const { texture: albedoTexture } = useTexture2DRid(
    properties.texture_albedo,
    externalResources,
    internalResources
  );
  const albedo = albedoTexture ?? null;

  // An active AnimationPlayer can drive `modulate` and `size` (ADR-0017); `null`
  // means none is, so the authored value shows. The projection maths is
  // identical for driven and authored values.
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

  // Godot stores modulate in sRGB → linear for the shaded material tint.
  const color = useGodotLinearColor(modulate);
  // albedo_mix scales how strongly the projected albedo replaces the surface;
  // fold it with modulate alpha into the projection's opacity.
  const opacity = clamp(properties.albedo_mix * modulate.a, 0, 1);

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
    // inherits a Repeat from the shared producer. The blit copies any format into an RGBA8 atlas
    // (`texture_storage.cpp:3163`) that the shader reads through its sRGB view
    // (`render_forward_clustered.cpp:3213`), so a decal decodes sRGB whatever its source format.
    // The atlas blits its own mip chain, sampled at the `decals/filter` default of Linear Mipmap
    // (`rendering_server.cpp:3804`), so a decal mipmaps even when its import has none.
    const projectionMap = applyTextureState(albedo, {
      repeat: false,
      colorSpace: THREE.SRGBColorSpace,
      buildsMipChain: true,
    });

    const projection: DecalProjectionLook = { map: projectionMap, color, opacity };
    const materials = new DecalProjectionMaterials(projection);
    materialsRef.current = materials;

    // The upper, lower and normal fades bake per vertex into the `color` attribute (`decalFade.ts`).
    const fade: DecalGeometricFade = {
      upperFade: properties.upper_fade,
      lowerFade: properties.lower_fade,
      normalFade: properties.normal_fade,
    };

    for (const receiver of receivers) {
      const geometry = buildDecalProjectionGeometry(receiver, decalWorldInverse, size, fade);
      if (!geometry) continue;
      const mesh = materials.project(geometry, receiver);
      mesh.userData.isDecalProjection = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 3;
      // A projection is a visual overlay, not pickable geometry: clicks fall through to the
      // surface beneath it and never re-select through it.
      mesh.raycast = () => {};
      group.add(mesh);
    }

    bakedRef.current = { receivers, meshVersion: meshesRef.current?.version ?? 0 };
    invalidate();

    return () => {
      bakedRef.current = null;
      for (const child of group.children.slice()) {
        group.remove(child);
        (child as THREE.Mesh).geometry?.dispose();
      }
      materialsRef.current = null;
      materials.dispose();
      releaseBoundTexture(projectionMap);
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
    lateReceiverBakes,
  ]);

  // A receiver can mount after the bake, as a Label3D does once its font loads. Godot's clustered
  // decal finds it the next frame. The tracker lists the scene's meshes without a walk and changes
  // its version when one arrives or leaves, so a render where none did costs one comparison. The
  // latest box inputs sit in a ref, so an animated `size` does not resubscribe every frame.
  const boxInputsRef = useRef({ size, cullMask: properties.cull_mask });
  boxInputsRef.current = { size, cullMask: properties.cull_mask };
  useEffect(() => {
    const group = projectionRef.current;
    if (!group) return undefined;
    const meshes = new TrackedObjects(scene, isSceneMesh);
    meshes.current();
    meshesRef.current = meshes;
    const stop = observeSceneCamera(scene, () => {
      const baked = bakedRef.current;
      if (!baked || meshes.version === baked.meshVersion) return;
      baked.meshVersion = meshes.version;
      scene.updateMatrixWorld(true);
      const { size: boxSize, cullMask } = boxInputsRef.current;
      const boxAABB = computeDecalBoxWorldAABB(group.matrixWorld, boxSize);
      const receivers = collectDecalReceivers(scene, boxAABB, cullMask);
      if (!sameElements(receivers, baked.receivers)) setLateReceiverBakes((bakes) => bakes + 1);
    });
    return () => {
      stop();
      meshes.dispose();
      meshesRef.current = null;
    };
  }, [scene]);

  // Before each render, for whichever camera renders the scene, the projections follow their
  // receivers' shading, and the decal takes its distance fade. Godot computes that fade per decal per
  // render, not per fragment: `update_decal_buffer` measures the rendering camera's distance to the
  // decal's origin, culls past `begin + length` and folds the rest into modulate alpha.
  const {
    distance_fade_enabled: fades,
    distance_fade_begin: fadeBegin,
    distance_fade_length: fadeLength,
  } = properties;
  useEffect(() => {
    const group = projectionRef.current;
    if (!group) return undefined;
    const stop = observeSceneCamera(scene, (camera) => {
      const materials = materialsRef.current;
      if (!materials) return;
      materials.followReceivers();
      if (fades)
        showFaded(
          group,
          materials,
          opacity,
          distanceFade(fadeBegin, fadeLength, cameraDistance(group, camera))
        );
    });
    return () => {
      stop();
      // A decal faded or hidden by an earlier render stays so unless the end of the fade restores
      // it. A rebuild has already dropped its materials, and builds its next ones unfaded, but the
      // group outlives it.
      group.visible = true;
      materialsRef.current?.setOpacity(opacity);
    };
  }, [scene, fades, fadeBegin, fadeLength, opacity]);

  return (
    <Node3D node={node}>
      {/* Godot's editor outlines the projector box for every decal, faint while it is not selected
          (`decal_gizmo_plugin.cpp:128`), and its runtime, which the reference renders, draws none. */}
      <PluginGizmo drawnFor="every-node">
        <group scale={[size.x, size.y, size.z]}>
          <GizmoLine positions={UNIT_BOX_EDGES} color={BOX_COLOR} opacity={BOX_ALPHA} />
        </group>
      </PluginGizmo>
      {/* Projection meshes attach here imperatively, to an unscaled group, so
          they inherit only the decal's world transform, not `size`. */}
      <group ref={projectionRef} />
      {children}
    </Node3D>
  );
}

/** Folds `fade` into the decal's opacity. Godot drops a fully faded decal, and so does the group. */
function showFaded(
  group: THREE.Group,
  materials: DecalProjectionMaterials,
  opacity: number,
  fade: number
): void {
  materials.setOpacity(opacity * fade);
  group.visible = fade > 0;
}

/** A mesh a decal can receive on: its own and every decal's projection meshes are not receivers. */
function isSceneMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true && object.userData.isDecalProjection !== true;
}
