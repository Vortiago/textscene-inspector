/**
 * PointLight2D draws nothing on the canvas, as in Godot: it adds its cookie to
 * the accumulation buffer every lit canvas item multiplies its albedo against
 * (`r3f/lighting2d/CanvasLighting2D`). CanvasItem2D supplies transform, `visible` and z.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import {
  useRegisterShadowSplitLight,
  useRegisterShadowTint,
  useShadowTintLayer,
} from '../../../r3f/lighting2d/CanvasLighting2D';
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

  const lights = props.enabled && !!displayedTexture ? 1 : 0;
  // `canvas.glsl:806` shadows only an item whose `light_mask` meets `shadow_item_cull_mask`. With
  // no reached item meeting it, the shadow lands nowhere, so the light casts nothing and stays whole.
  const shadowReachesItem = (props.range_item_cull_mask & props.shadow_item_cull_mask) !== 0;
  const shadowEnabled = props.shadow_enabled && shadowReachesItem;
  const casters = useLightShadowCasters(shadowEnabled, props.shadow_item_cull_mask);
  // The cull tuple, not the node's own `light_mask` (its CanvasItem mask), picks
  // the items this light reaches. Split by the shadow mask, it keys the registration
  // and the quad layers. Not memoised: every consumer compares it by value, so a
  // stable identity buys nothing.
  const rangeKey: LightCullKey = {
    ...DEFAULT_LIGHT_CULL_KEY,
    itemCullMask: props.range_item_cull_mask,
    zMin: props.range_z_min,
    zMax: props.range_z_max,
    layerMin: props.range_layer_min,
    layerMax: props.range_layer_max,
  };
  const {
    key: cullKey,
    ordinal,
    layer,
    unshadowedLayer,
  } = useRegisterShadowSplitLight(
    lights > 0,
    rangeKey,
    casters.length > 0 ? props.shadow_item_cull_mask : null
  );
  // Two different jobs, deliberately two different numbers: `ordinal` keeps the
  // shadow stencil stamps of one pass apart (dense, reused on unmount), while
  // `sequence` is this light's position in the canvas light list, which is what
  // Godot applies lights in and what order-dependent MIX depends on.
  const sequence = useLightSequence(ordinal);
  // Godot's default shadow_color is transparent, so the extra albedo-free pass
  // is allocated only for the rare light that actually tints its shadow.
  const tintsShadow = shadowEnabled && shadowColorContributes(props.shadow_color);
  useRegisterShadowTint(lights > 0 && tintsShadow, cullKey);
  const shadowTintLayer = useShadowTintLayer(cullKey);

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
            layer={layer}
            unshadowedLayer={unshadowedLayer}
            sequence={sequence}
            shadowTintLayer={tintsShadow ? shadowTintLayer : undefined}
            ordinal={ordinal}
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
 * The cookie quad, the unshadowed quad and the `shadow_color` quad share this
 * component, so their geometry and offset cannot drift. Only their layer and
 * material differ. Complementary stencil tests keep the cookie and `shadow_color`
 * quads off each other's pixels, and the unshadowed quad draws into another class.
 */
function LightQuad({
  layer,
  onMesh,
  material,
  offset,
  width,
  height,
  sequence,
}: {
  /**
   * The class layer that keeps this quad out of the visible pass: each class's accumulation
   * pre-pass renders its own layer alone, and the main pass renders none of them.
   */
  layer: number;
  /** Receives the mounted mesh, and null on unmount. */
  onMesh?: (mesh: THREE.Mesh | null) => void;
  material: THREE.Material;
  offset: { x: number; y: number };
  width: number;
  height: number;
  /** The render-order slot: the light's place in the canvas light list. */
  sequence: number;
}) {
  const toLayer = useCallback(
    (mesh: THREE.Mesh | null) => {
      mesh?.layers.set(layer);
      onMesh?.(mesh);
    },
    [layer, onMesh]
  );

  return (
    <mesh
      ref={toLayer}
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
  layer,
  unshadowedLayer,
  shadowTintLayer,
  ordinal,
  sequence,
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
  /** The albedo-free pass's layer, set only when this light tints its shadow. */
  shadowTintLayer: number | undefined;
  /** The camera layer of this light's cull-mask class. */
  layer: number;
  /** The layer of the shadowless quad for the items the shadow misses, set only once some do. */
  unshadowedLayer: number | undefined;
  /** This light's index within its class: its stencil ref, not its draw order. */
  ordinal: number;
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
        stencil: shadowed && !filtered ? litQuadStencilProps(ordinal) : undefined,
        shadow: sampling,
      }),
    [cookie, color, energy, blendMode, shadowed, filtered, ordinal, sampling]
  );
  useEffect(() => () => material.dispose(), [material]);

  const isSplit = unshadowedLayer !== undefined;
  const unshadowedMaterial = useMemo(
    () => (isSplit ? createLightQuadMaterial({ cookie, color, energy, blendMode }) : null),
    [isSplit, cookie, color, energy, blendMode]
  );
  useEffect(() => () => unshadowedMaterial?.dispose(), [unshadowedMaterial]);

  // The other half of `light_shadow_compute`: the light's contribution where the
  // volumes stamped. Null at Godot's transparent default. A defined
  // `shadowTintLayer` already means the light tints, so `shadowColorContributes`
  // is not asked twice, where the two answers could drift.
  const tintsShadow = shadowed && shadowTintLayer !== undefined;
  const shadowMaterial = useMemo(() => {
    if (!tintsShadow) return null;
    // A sampling is the filtered branch, and it carries the colour, so the two
    // quads of one light cannot be handed different `shadow_color`s.
    return sampling
      ? createShadowColorQuadMaterial({ cookie, blendMode, shadow: sampling })
      : createShadowColorQuadMaterial({
          cookie,
          blendMode,
          shadowColor,
          stencil: shadowColorQuadStencilProps(ordinal),
        });
  }, [tintsShadow, cookie, shadowColor, blendMode, ordinal, sampling]);
  useEffect(() => () => shadowMaterial?.dispose(), [shadowMaterial]);

  const shape = { offset, width: width * scale, height: height * scale, sequence };

  return (
    <>
      {shadowed && !filtered && (
        <ShadowVolumeMask
          light={light}
          casters={casters}
          ordinal={ordinal}
          sequence={sequence}
          layer={layer}
          tintLayer={shadowTintLayer}
        />
      )}
      <LightQuad layer={layer} onMesh={setQuad} material={material} {...shape} />
      {unshadowedMaterial && unshadowedLayer !== undefined && (
        <LightQuad layer={unshadowedLayer} material={unshadowedMaterial} {...shape} />
      )}
      {shadowMaterial && shadowTintLayer !== undefined && (
        <LightQuad layer={shadowTintLayer} material={shadowMaterial} {...shape} />
      )}
    </>
  );
}
