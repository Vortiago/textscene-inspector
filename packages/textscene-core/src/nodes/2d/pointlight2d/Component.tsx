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
  useLightClassLayer,
  useRegisterShadowTint,
  useShadowTintLayer,
  useRegisterCanvasLight2D,
} from '../../../r3f/lighting2d/CanvasLighting2D';
import type { LightCullKey } from '../../../r3f/lighting2d/lightCullKey';
import { useWorldShadowCasters } from '../../../r3f/lighting2d/ShadowCasterStage';
import { useShadowLightPose } from '../../../r3f/lighting2d/shadowLightPose';
import {
  litQuadRenderOrder,
  litQuadStencilProps,
  shadowColorQuadStencilProps,
  ShadowVolumeMask,
} from '../../../r3f/lighting2d/ShadowVolumeMask';
import type { WorldShadowCaster } from '../../../r3f/lighting2d/shadowCasterRegistry';

const NO_CASTERS: readonly WorldShadowCaster[] = [];

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
  // The cull tuple, not the node's own `light_mask` (its CanvasItem mask), picks
  // the items this light reaches, so it keys the registration and the quad layer.
  // Not memoised: every consumer compares it by value, so a stable identity buys
  // nothing.
  const cullKey: LightCullKey = {
    itemCullMask: props.range_item_cull_mask,
    zMin: props.range_z_min,
    zMax: props.range_z_max,
    layerMin: props.range_layer_min,
    layerMax: props.range_layer_max,
  };
  const ordinal = useRegisterCanvasLight2D(lights > 0, cullKey);
  // Two different jobs, deliberately two different numbers: `ordinal` keeps the
  // shadow stencil stamps of one pass apart (dense, reused on unmount), while
  // `sequence` is this light's position in the canvas light list, which is what
  // Godot applies lights in and what order-dependent MIX depends on.
  const sequence = useLightSequence(ordinal);
  const layer = useLightClassLayer(cullKey);
  // Godot's default shadow_color is transparent, so the extra albedo-free pass
  // is allocated only for the rare light that actually tints its shadow.
  const tintsShadow = props.shadow_enabled && shadowColorContributes(props.shadow_color);
  useRegisterShadowTint(lights > 0 && tintsShadow, cullKey);
  const shadowTintLayer = useShadowTintLayer(cullKey);

  // Every occluder on the canvas, narrowed to the ones Godot lets this light
  // see. The flatten is shared; only the mask test is per light.
  const allCasters = useWorldShadowCasters();
  const shadowItemCullMask = props.shadow_item_cull_mask;
  const casters = useMemo(
    () =>
      props.shadow_enabled
        ? allCasters.filter((caster) => (caster.occluderLightMask & shadowItemCullMask) !== 0)
        : NO_CASTERS,
    [props.shadow_enabled, allCasters, shadowItemCullMask]
  );

  if (!props.enabled) return null;

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={() =>
        showPlaceholder ? (
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
 * The cookie quad and the `shadow_color` quad share this component, so their
 * geometry and offset cannot drift. Only their layer and material differ, and
 * complementary stencil tests keep them off each other's pixels.
 */
function LightQuad({
  meshRef,
  material,
  offset,
  width,
  height,
  sequence,
}: {
  meshRef: (mesh: THREE.Mesh | null) => void;
  material: THREE.Material;
  offset: { x: number; y: number };
  width: number;
  height: number;
  /** The render-order slot: the light's place in the canvas light list. */
  sequence: number;
}) {
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
  layer,
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
  /** This light's index within its class: its stencil ref, not its draw order. */
  ordinal: number;
  /** This light's place in the canvas light list, which is its draw order. */
  sequence: number;
  /** The occluders this light is allowed to see, in world space. */
  casters: readonly WorldShadowCaster[];
}) {
  const width = (texture.image as { width?: number } | null | undefined)?.width ?? 1;
  const height = (texture.image as { height?: number } | null | undefined)?.height ?? 1;

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
        cookie: texture,
        color,
        energy,
        blendMode,
        // A filtered light computes its own fraction per fragment, so it needs
        // no stencil ref and stamps nothing.
        stencil: shadowed && !filtered ? litQuadStencilProps(ordinal) : undefined,
        shadow: sampling,
      }),
    [texture, color, energy, blendMode, shadowed, filtered, ordinal, sampling]
  );
  useEffect(() => () => material.dispose(), [material]);

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
      ? createShadowColorQuadMaterial({ cookie: texture, blendMode, shadow: sampling })
      : createShadowColorQuadMaterial({
          cookie: texture,
          blendMode,
          shadowColor,
          stencil: shadowColorQuadStencilProps(ordinal),
        });
  }, [tintsShadow, texture, shadowColor, blendMode, ordinal, sampling]);
  useEffect(() => () => shadowMaterial?.dispose(), [shadowMaterial]);

  // The light layer is what keeps this quad out of the visible pass and what
  // sorts it into its cull-mask class: each class's accumulation pre-pass
  // renders its own layer alone, and the main pass renders none of them.
  const toLightLayer = useCallback(
    (mesh: THREE.Mesh | null) => {
      mesh?.layers.set(layer);
    },
    [layer]
  );

  const toShadowTintLayer = useCallback(
    (mesh: THREE.Mesh | null) => {
      if (shadowTintLayer !== undefined) mesh?.layers.set(shadowTintLayer);
    },
    [shadowTintLayer]
  );

  const toLightQuad = useCallback(
    (mesh: THREE.Mesh | null) => {
      toLightLayer(mesh);
      setQuad(mesh);
    },
    [toLightLayer]
  );

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
      <LightQuad
        meshRef={toLightQuad}
        material={material}
        offset={offset}
        width={width * scale}
        height={height * scale}
        sequence={sequence}
      />
      {shadowMaterial && (
        <LightQuad
          meshRef={toShadowTintLayer}
          material={shadowMaterial}
          offset={offset}
          width={width * scale}
          height={height * scale}
          sequence={sequence}
        />
      )}
    </>
  );
}
