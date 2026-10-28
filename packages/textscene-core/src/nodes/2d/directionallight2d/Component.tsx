/**
 * DirectionalLight2D draws nothing on the canvas, as in Godot: it adds one term over the whole
 * accumulation buffer every lit canvas item multiplies its albedo against
 * (`r3f/lighting2d/CanvasLighting2D`). It reaches every lit item on its canvas layers
 * (`canvas.glsl:726`, `renderer_viewport.cpp:679-685`), and
 * its shadow samples a parallel map (`directionalShadowMap.ts`) built over the view.
 */

import { useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import type { DirectionalLight2DProperties } from './types';
import { usePassMeshRef, useRegisterCanvasLight2D } from '../../../r3f/lighting2d/CanvasLighting2D';
import { directionalRenderOrder } from '../../../r3f/lighting2d/lightPassLayers';
import { directionalLightCullKey } from '../../../r3f/lighting2d/lightCullKey';
import { useDirectionalLightSlot } from '../../../r3f/lighting2d/useLightSequence';
import { useLightShadowCasters } from '../../../r3f/lighting2d/ShadowCasterStage';
import type { WorldShadowCaster } from '../../../r3f/lighting2d/shadowCasterRegistry';
import { shadowColorContributes } from '../../../r3f/lighting2d/lightQuad';
import { useDirectionalShadow } from '../../../r3f/lighting2d/directionalShadowView';
import { FullScreenQuad } from '../../../r3f/lighting2d/fullScreenQuad';
import {
  createDirectionalLightMaterial,
  createDirectionalShadowColorMaterial,
  type DirectionalShadowSampling,
} from '../../../r3f/lighting2d/directionalLightQuad';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { Light2DBlendMode } from '../../../godot/scene/light2d';

export function DirectionalLight2D({ node, children }: NodeComponentProps) {
  const props = node.properties as DirectionalLight2DProperties;
  // Null while Godot leaves the light off its directional list: disabled, hidden, or past the
  // eighth light of a canvas (`light_2d.cpp:59`, `renderer_viewport.cpp:492-513`).
  const slot = useDirectionalLightSlot();
  const lit = props.enabled && slot !== null;

  const casters = useLightShadowCasters(props.shadow_enabled, props.shadow_item_cull_mask);
  // Its shadow reaches every item it lights, so it declares no `shadow_item_cull_mask`.
  const tintsShadow = casters.length > 0 && shadowColorContributes(props.shadow_color, props.shadow_filter);
  const ordinal = useRegisterCanvasLight2D(lit, {
    reach: directionalLightCullKey(props.range_layer_min, props.range_layer_max),
    sequence: null,
    slot: slot ?? undefined,
    shadowItemCullMask: null,
    tintsShadow,
  });

  // A disabled light still draws its children: `enabled` switches the light alone.
  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={() =>
        lit ? (
          <DirectionalLightQuads
            props={props}
            ordinal={ordinal}
            tintsShadow={tintsShadow}
            renderOrder={directionalRenderOrder(slot)}
            casters={casters}
          />
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

function DirectionalLightQuads({
  props,
  ordinal,
  tintsShadow,
  renderOrder,
  casters,
}: {
  props: DirectionalLight2DProperties;
  /** This light's ordinal on the canvas, or null while undeclared. */
  ordinal: number | null;
  /** Whether the light casts with a visible `shadow_color`. */
  tintsShadow: boolean;
  /** Its draw order, from its slot in the directional list. */
  renderOrder: number;
  /** The occluders this light is allowed to see, in world space. */
  casters: readonly WorldShadowCaster[];
}) {
  const { color, energy, blend_mode: blendMode, shadow_filter, shadow_filter_smooth, shadow_color } = props;

  // Held in state, so the shadow starts once the quad is in the tree: the light's world matrix
  // does not exist before that.
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const { map: shadowMap, ndcToShadow } = useDirectionalShadow(quad, casters, props.max_distance);
  const hasMap = quad !== null && casters.length > 0;
  const sampling = useMemo<DirectionalShadowSampling | undefined>(
    () =>
      hasMap
        ? {
            map: shadowMap,
            filter: shadow_filter,
            smooth: shadow_filter_smooth,
            ndcToShadow,
            shadowColor: shadow_color,
          }
        : undefined,
    [hasMap, shadowMap, shadow_filter, shadow_filter_smooth, ndcToShadow, shadow_color]
  );

  const material = useMemo(
    () => createDirectionalLightMaterial({ color, energy, blendMode, shadow: sampling }),
    [color, energy, blendMode, sampling]
  );
  useDisposeOnRelease(material);

  // A MIX light scales the tint buffer under it by its alpha, so it draws there untinted too.
  const drawsTint = blendMode === Light2DBlendMode.MIX || (!!sampling && tintsShadow);
  const shadowMaterial = useMemo(
    () =>
      drawsTint ? createDirectionalShadowColorMaterial({ color, energy, blendMode, shadow: sampling }) : null,
    [drawsTint, sampling, color, energy, blendMode]
  );
  useDisposeOnRelease(shadowMaterial);

  const litRef = usePassMeshRef<THREE.Mesh>(ordinal, 'lit', setQuad);
  const tintRef = usePassMeshRef<THREE.Mesh>(ordinal, 'tint');

  return (
    <>
      <FullScreenQuad meshRef={litRef} material={material} renderOrder={renderOrder} />
      {shadowMaterial && (
        <FullScreenQuad meshRef={tintRef} material={shadowMaterial} renderOrder={renderOrder} />
      )}
    </>
  );
}
