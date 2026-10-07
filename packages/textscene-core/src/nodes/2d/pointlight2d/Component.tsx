/**
 * PointLight2D draws nothing on the canvas, as in Godot: it adds its cookie to
 * the accumulation buffer every lit canvas item multiplies its albedo against
 * (`r3f/lighting2d/CanvasLighting2D`). CanvasItem2D supplies transform, `visible` and z.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { useTexture2D } from '../../../resources/useTexture2D';
import { applyTextureState, isMaterialOwnedTexture } from '../../../resources/textures/applyTextureState';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import type { PointLight2DProperties } from './types';
import type { Color } from '../../base/node2d/types';
import {
  createLightQuadMaterial,
  createShadowColorQuadMaterial,
  updateShadowPolarTexture,
  shadowColorContributes,
  SHADOW_FILTER_NONE,
  SHADOW_FILTER_PCF5,
  SHADOW_FILTER_PCF13,
  type ShadowSampling,
} from '../../../r3f/lighting2d/lightQuad';
import { buildShadowPolarMap, shadowMapZFarInv } from '../../../r3f/lighting2d/shadowPolarMap';
import { useLightSequence } from '../../../r3f/lighting2d/useLightSequence';
import { usePassMeshRef, useRegisterCanvasLight2D } from '../../../r3f/lighting2d/CanvasLighting2D';
import type { PassMeshRole } from '../../../r3f/lighting2d/itemLightList';
import { DEFAULT_LIGHT_CULL_KEY, type LightCullKey } from '../../../r3f/lighting2d/lightCullKey';
import { useLightShadowCasters } from '../../../r3f/lighting2d/ShadowCasterStage';
import { useShadowLightPose } from '../../../r3f/lighting2d/shadowLightPose';
import {
  litQuadRenderOrder,
  litQuadStencilProps,
  shadowColorQuadStencilProps,
  ShadowVolumeMask,
} from '../../../r3f/lighting2d/ShadowVolumeMask';
import type { WorldShadowCaster } from '../../../r3f/lighting2d/shadowCasterRegistry';

export function PointLight2D({ node, children }: NodeComponentProps) {
  const props = node.properties as PointLight2DProperties;
  const { externalResources, internalResources } = useSceneResources();

  // The cookie is often a GradientTexture2D, a radial falloff described inline,
  // not an image. `useTexture2D` resolves either kind.
  const { texture: displayedTexture, missing } = useTexture2D(
    props.texture,
    externalResources,
    internalResources
  );
  const showPlaceholder = missing || !props.texture;

  const lights = props.enabled && !!displayedTexture;
  // `canvas.glsl:806` shadows only an item whose `light_mask` meets `shadow_item_cull_mask`. With
  // no reached item meeting it, the shadow lands nowhere, so the light casts nothing.
  const shadowReachesItem = (props.range_item_cull_mask & props.shadow_item_cull_mask) !== 0;
  const shadowEnabled = props.shadow_enabled && shadowReachesItem;
  const casters = useLightShadowCasters(shadowEnabled, props.shadow_item_cull_mask);
  const casts = casters.length > 0;
  // The cull tuple, not the node's own `light_mask` (its CanvasItem mask), picks the items this
  // light reaches. Not memoised: the declaration is compared by value.
  const reach: LightCullKey = {
    ...DEFAULT_LIGHT_CULL_KEY,
    itemCullMask: props.range_item_cull_mask,
    zMin: props.range_z_min,
    zMax: props.range_z_max,
    layerMin: props.range_layer_min,
    layerMax: props.range_layer_max,
  };
  // Godot's default shadow_color is transparent, so the extra albedo-free pass runs only for the
  // rare light that tints its shadow.
  const tintsShadow = casts && shadowColorContributes(props.shadow_color);
  const ordinal = useRegisterCanvasLight2D(lights, {
    reach,
    shadowItemCullMask: casts ? props.shadow_item_cull_mask : null,
    tintsShadow,
  });
  // Two jobs, two numbers: `ordinal` keeps the shadow stencil stamps of one pass apart (dense,
  // reused on unmount), while `sequence` is this light's position in the canvas light list, which
  // is what Godot applies lights in and what order-dependent MIX depends on.
  const sequence = useLightSequence(ordinal ?? 0);
  // An item the light reaches through a bit outside `shadow_item_cull_mask` takes it unshadowed.
  const reachesUnshadowedItem = (props.range_item_cull_mask & ~props.shadow_item_cull_mask) !== 0;

  // A disabled light still draws its children: `enabled` switches the light alone.
  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={() =>
        !props.enabled ? null : showPlaceholder ? (
          <MissingResourcePlaceholder shape="plane" name={node.name} />
        ) : displayedTexture ? (
          <QuadMesh
            texture={displayedTexture}
            color={props.color}
            energy={props.energy}
            scale={props.texture_scale}
            offset={props.offset}
            blendMode={props.blend_mode}
            shadowColor={props.shadow_color}
            shadowFilter={props.shadow_filter}
            shadowFilterSmooth={props.shadow_filter_smooth}
            ordinal={ordinal}
            sequence={sequence}
            tintsShadow={tintsShadow}
            reachesUnshadowedItem={reachesUnshadowedItem}
            casters={casters}
          />
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

/**
 * The cookie quad, the unshadowed quad and the `shadow_color` quad share this component, so their
 * geometry and offset cannot drift. Only their role and material differ. Complementary stencil
 * tests keep the cookie and `shadow_color` quads off each other's pixels, and the pass draws the
 * unshadowed quad only for a list on which the light is unshadowed.
 */
function LightQuad({
  ordinal,
  role,
  onMesh,
  material,
  offset,
  width,
  height,
  sequence,
}: {
  /** The light's ordinal, or null while it is undeclared. */
  ordinal: number | null;
  /** Which passes draw the quad. */
  role: PassMeshRole;
  /** Receives the mounted mesh, and null on unmount. */
  onMesh?: (mesh: THREE.Mesh | null) => void;
  material: THREE.Material;
  offset: { x: number; y: number };
  width: number;
  height: number;
  /** The render-order slot: the light's place in the canvas light list. */
  sequence: number;
}) {
  const meshRef = usePassMeshRef(ordinal, role, onMesh);

  return (
    <mesh
      ref={meshRef}
      position={[offset.x, -offset.y, 0]}
      material={material}
      // Explicit rather than left to three's depth sort, because the volume mask
      // has to land between this quad and the previous light's.
      renderOrder={litQuadRenderOrder(sequence)}
    >
      <planeGeometry args={[width, height]} />
    </mesh>
  );
}

function QuadMesh({
  texture,
  color,
  energy,
  scale,
  offset,
  blendMode,
  shadowColor,
  shadowFilter,
  shadowFilterSmooth,
  ordinal,
  sequence,
  tintsShadow,
  reachesUnshadowedItem,
  casters,
}: {
  texture: THREE.Texture;
  color: Color;
  energy: number;
  scale: number;
  offset: { x: number; y: number };
  blendMode: number;
  /** `Light2D.shadow_color`: what this light contributes where it is blocked. */
  shadowColor: Color;
  /** `Light2D.shadow_filter`: NONE picks the stencil, PCF5/PCF13 the polar map. */
  shadowFilter: number;
  /** `Light2D.shadow_filter_smooth`: how wide the PCF taps spread the boundary. */
  shadowFilterSmooth: number;
  /** Whether the light casts with a visible `shadow_color`. */
  tintsShadow: boolean;
  /** Whether an item the light reaches can miss `shadow_item_cull_mask`. */
  reachesUnshadowedItem: boolean;
  /** This light's ordinal on the canvas, its stencil ref, or null while undeclared. */
  ordinal: number | null;
  /** This light's place in the canvas light list, which is its draw order. */
  sequence: number;
  /** The occluders this light is allowed to see, in world space. */
  casters: readonly WorldShadowCaster[];
}) {
  const width = (texture.image as { width?: number } | null | undefined)?.width ?? 1;
  const height = (texture.image as { height?: number } | null | undefined)?.height ?? 1;

  // Godot resolves a canvas item's DEFAULT repeat to the viewport's DISABLED default
  // (`viewport.h:419-420`, `renderer_canvas_render_rd.cpp:2344`), and the light-texture
  // tap uses that item sampler (`canvas.glsl:774-782`). The cookie states clamp and never
  // inherits a Repeat from the shared producer; a clamp-tagged entry is reused as-is.
  const cookie = useMemo(
    () => applyTextureState(texture, { repeat: false, colorSpace: THREE.SRGBColorSpace }),
    [texture]
  );
  useEffect(
    () => () => {
      if (isMaterialOwnedTexture(cookie)) cookie.dispose();
    },
    [cookie]
  );

  // A callback ref, not useRef, so the pose sampler starts once the quad is in
  // the tree: the world matrix it needs does not exist before that.
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const light = useShadowLightPose(quad, casters.length > 0);
  const shadowed = !!light && casters.length > 0;
  // `shadow_filter` picks the mechanism. NONE stencils: the volumes stamp and the
  // cookie draws only where they did not, as Godot's transparent default
  // `shadow_color` adds nothing there. PCF5/PCF13 sample the polar map through
  // Godot's tap kernel, for its stepped penumbra.
  const filtered = shadowed && shadowFilter !== SHADOW_FILTER_NONE;

  // Built only for a filtered light, so an unfiltered one runs none of that path.
  // It is a pure function of the pose and the casters, so it rebuilds exactly
  // when the volumes do.
  const bins = useMemo(
    () => (filtered && light ? buildShadowPolarMap(light, casters) : null),
    [filtered, light, casters]
  );

  // The texture outlives each rebuild: both quad materials hold its identity in
  // `uShadowMap`, so an occluder settling during load refills it rather than
  // rebuilding two ShaderMaterials. The refill runs at commit, since a write from
  // a render React discards would reach the materials already on screen.
  const [shadowMap, setShadowMap] = useState<THREE.DataTexture | null>(null);
  useLayoutEffect(() => {
    if (!bins) {
      setShadowMap(null);
      return;
    }
    const next = updateShadowPolarTexture(shadowMap, bins);
    if (next !== shadowMap) setShadowMap(next);
  }, [bins, shadowMap]);

  // Keyed on the texture, not on mount, so a light that stops being shadowed
  // (its occluders hidden, or the sub-scene carrying them swapped out) gives
  // the GL object back instead of holding it for the session.
  useEffect(() => () => shadowMap?.dispose(), [shadowMap]);

  const sampling = useMemo<ShadowSampling | undefined>(() => {
    if (!shadowMap || !light) return undefined;
    const [m00, m01, m02, m10, m11, m12] = light.worldToLocal;
    return {
      map: shadowMap,
      // Anything the parser admits that is not NONE takes the wider kernel only
      // at PCF13; `shadow_filter` is a three-value enum, so this is exhaustive.
      filter: shadowFilter === SHADOW_FILTER_PCF13 ? SHADOW_FILTER_PCF13 : SHADOW_FILTER_PCF5,
      smooth: shadowFilterSmooth,
      worldToLocal: new THREE.Matrix3().set(m00, m01, m02, m10, m11, m12, 0, 0, 1),
      zFarInv: shadowMapZFarInv(light.radius),
      shadowColor,
    };
  }, [shadowMap, light, shadowFilter, shadowFilterSmooth, shadowColor]);

  const material = useMemo(
    () =>
      createLightQuadMaterial({
        cookie,
        color,
        energy,
        blendMode,
        // A filtered light computes its own fraction per fragment, so it needs
        // no stencil ref and stamps nothing.
        stencil: shadowed && !filtered ? litQuadStencilProps(ordinal ?? 0) : undefined,
        shadow: sampling,
      }),
    [cookie, color, energy, blendMode, shadowed, filtered, ordinal, sampling]
  );
  useEffect(() => () => material.dispose(), [material]);

  const drawsUnshadowed = casters.length > 0 && reachesUnshadowedItem;
  const unshadowedMaterial = useMemo(
    () => (drawsUnshadowed ? createLightQuadMaterial({ cookie, color, energy, blendMode }) : null),
    [drawsUnshadowed, cookie, color, energy, blendMode]
  );
  useEffect(() => () => unshadowedMaterial?.dispose(), [unshadowedMaterial]);

  // The other half of `light_shadow_compute`: the light's contribution where the
  // volumes stamped. Null at Godot's transparent default.
  const drawsTint = shadowed && tintsShadow;
  const shadowMaterial = useMemo(() => {
    if (!drawsTint) return null;
    // A sampling is the filtered branch, and it carries the colour, so the two
    // quads of one light cannot be handed different `shadow_color`s.
    return sampling
      ? createShadowColorQuadMaterial({ cookie, blendMode, shadow: sampling })
      : createShadowColorQuadMaterial({
          cookie,
          blendMode,
          shadowColor,
          stencil: shadowColorQuadStencilProps(ordinal ?? 0),
        });
  }, [drawsTint, cookie, shadowColor, blendMode, ordinal, sampling]);
  useEffect(() => () => shadowMaterial?.dispose(), [shadowMaterial]);

  const shape = { ordinal, offset, width: width * scale, height: height * scale, sequence };

  return (
    <>
      {shadowed && !filtered && ordinal !== null && (
        <ShadowVolumeMask light={light} casters={casters} ordinal={ordinal} sequence={sequence} />
      )}
      <LightQuad role="lit" onMesh={setQuad} material={material} {...shape} />
      {unshadowedMaterial && <LightQuad role="unshadowed" material={unshadowedMaterial} {...shape} />}
      {shadowMaterial && <LightQuad role="tint" material={shadowMaterial} {...shape} />}
    </>
  );
}
