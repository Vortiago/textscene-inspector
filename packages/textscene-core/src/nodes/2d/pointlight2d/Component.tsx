/**
 * <PointLight2D> — a 2D point light. It draws nothing on the canvas, as Godot's
 * lights do not: it contributes its cookie to the accumulation buffer that
 * every lit canvas item multiplies its albedo against (see
 * `r3f/lighting2d/CanvasLighting2D`).
 *
 * The quad sits on the light camera layer, so the main pass never sees it and
 * the light pre-pass sees nothing else. It is still wrapped in CanvasItem2D so
 * its transform, `visible` and z come from the same ritual as any other node.
 *
 * A SHADOWED light is two meshes rather than one, in the order its ordinal
 * fixes: its shadow volumes stamp the stencil, then its cookie draws only where
 * they did not. Withholding the cookie IS the shadow, because Godot's default
 * `shadow_color = Color(0, 0, 0, 0)` contributes nothing where it falls.
 *
 * When `enabled=false` the body returns null and the light does not register.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  shadowColorContributes,
} from '../../../r3f/lighting2d/lightQuad';
import { useLightSequence } from '../../../r3f/lighting2d/useLightSequence';
import {
  useLightClassLayer,
  useRegisterShadowTint,
  useShadowTintLayer,
  useRegisterCanvasLight2D,
} from '../../../r3f/lighting2d/CanvasLighting2D';
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

  // The light cookie is a Texture2D slot like any other, and in real scenes it
  // is usually a GradientTexture2D — a radial falloff described inline rather
  // than shipped as an image. `useTexture2D` resolves either kind.
  const { texture: displayedTexture, missing } = useTexture2D(
    props.texture,
    externalResources,
    internalResources
  );
  const showPlaceholder = missing || !props.texture;

  const lights = props.enabled && !!displayedTexture ? 1 : 0;
  // `range_item_cull_mask`, which items this light reaches, is what partitions
  // the accumulation, so it is what the light registers under and what decides
  // the layer its quad draws on. The node's own `light_mask` is its CanvasItem
  // mask and has no bearing on either.
  const ordinal = useRegisterCanvasLight2D(lights > 0, props.range_item_cull_mask);
  // Two different jobs, deliberately two different numbers: `ordinal` keeps the
  // shadow stencil stamps of one pass apart (dense, reused on unmount), while
  // `sequence` is this light's position in the canvas light list, which is what
  // Godot applies lights in and what order-dependent MIX depends on.
  const sequence = useLightSequence(ordinal);
  const layer = useLightClassLayer(props.range_item_cull_mask);
  // Godot's default shadow_color is transparent, so the extra albedo-free pass
  // is allocated only for the rare light that actually tints its shadow.
  const tintsShadow = props.shadow_enabled && shadowColorContributes(props.shadow_color);
  useRegisterShadowTint(lights > 0 && tintsShadow);
  const shadowTintLayer = useShadowTintLayer(props.range_item_cull_mask);

  // Every occluder on the canvas, narrowed to the ones Godot lets THIS light
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

  // When disabled: return null → no mesh in tree.
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
 * The cookie quad and the `shadow_color` quad are the SAME quad: same size, same
 * offset, same slot in the pass. Only the layer they land on and the material
 * they carry differ, and the complementary stencil test means they never cover
 * the same pixel, so their relative order is moot. Sharing one component is what
 * stops the two drifting on geometry or offset.
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
  /** `Light2D.shadow_color` — what this light contributes where it IS blocked. */
  shadowColor: Color;
  /** The albedo-free pass's layer, set only when this light tints its shadow. */
  shadowTintLayer: number | undefined;
  /** The camera layer of this light's cull-mask class. */
  layer: number;
  /** This light's index within its class — its stencil ref. NOT its draw order. */
  ordinal: number;
  /** This light's place in the canvas light list, which IS its draw order. */
  sequence: number;
  /** The occluders this light is allowed to see, in world space. */
  casters: readonly WorldShadowCaster[];
}) {
  const width = (texture.image as { width?: number } | null | undefined)?.width ?? 1;
  const height = (texture.image as { height?: number } | null | undefined)?.height ?? 1;

  // A callback ref (not useRef) so the pose sampler starts once the quad is in
  // the tree — the world matrix it needs does not exist before that.
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const light = useShadowLightPose(quad, casters.length > 0);
  const shadowed = !!light && casters.length > 0;

  const material = useMemo(
    () =>
      createLightQuadMaterial(
        texture,
        color,
        energy,
        blendMode,
        shadowed ? litQuadStencilProps(ordinal) : {}
      ),
    [texture, color, energy, blendMode, shadowed, ordinal]
  );
  useEffect(() => () => material.dispose(), [material]);

  // The other half of `light_shadow_compute`: what the light contributes where
  // the volumes DID stamp. Null at Godot's transparent default, which is every
  // ordinary shadow — there the withheld cookie is the entire effect.
  // `shadowColorContributes` is NOT re-checked here: the node above passes a
  // layer only for a light that tints, so a defined layer already means it does.
  // Asking twice would let the two answers drift.
  const tintsShadow = shadowed && shadowTintLayer !== undefined;
  const shadowMaterial = useMemo(
    () =>
      tintsShadow
        ? createShadowColorQuadMaterial(
            texture,
            shadowColor,
            blendMode,
            shadowColorQuadStencilProps(ordinal)
          )
        : null,
    [tintsShadow, texture, shadowColor, blendMode, ordinal]
  );
  useEffect(() => () => shadowMaterial?.dispose(), [shadowMaterial]);

  // The light layer is what keeps this quad out of the visible pass AND what
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
      {shadowed && (
        <ShadowVolumeMask
          light={light}
          casters={casters}
          ordinal={ordinal}
          sequence={sequence}
          layer={layer}
          tintLayer={tintsShadow ? shadowTintLayer : undefined}
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
