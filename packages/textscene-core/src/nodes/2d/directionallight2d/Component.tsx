/**
 * DirectionalLight2D draws nothing on the canvas, as in Godot: it adds one term over the whole
 * accumulation buffer every lit canvas item multiplies its albedo against
 * (`r3f/lighting2d/CanvasLighting2D`). Its class reaches every item on its canvas layers, and
 * its shadow samples a parallel map (`directionalShadowMap.ts`) built over the view.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import type { DirectionalLight2DProperties } from './types';
import {
  useLightClassLayer,
  useRegisterCanvasLight2D,
  useRegisterShadowTint,
  useShadowTintLayer,
} from '../../../r3f/lighting2d/CanvasLighting2D';
import { directionalLightCullKey } from '../../../r3f/lighting2d/lightCullKey';
import { useDirectionalLightSlot } from '../../../r3f/lighting2d/useLightSequence';
import { useLightShadowCasters } from '../../../r3f/lighting2d/ShadowCasterStage';
import type { WorldShadowCaster } from '../../../r3f/lighting2d/shadowCasterRegistry';
import { shadowColorContributes } from '../../../r3f/lighting2d/lightQuad';
import { buildDirectionalShadowMap } from '../../../r3f/lighting2d/directionalShadowMap';
import { useDirectionalShadowView, useNdcToShadow } from '../../../r3f/lighting2d/directionalShadowView';
import { FullScreenQuad } from '../../../r3f/lighting2d/fullScreenQuad';
import {
  createDirectionalLightMaterial,
  createDirectionalShadowColorMaterial,
  createDirectionalShadowTexture,
  writeDirectionalShadowMap,
  type DirectionalShadowSampling,
} from '../../../r3f/lighting2d/directionalLightQuad';

export function DirectionalLight2D({ node, children }: NodeComponentProps) {
  const props = node.properties as DirectionalLight2DProperties;
  // Null while Godot leaves the light off its directional list: disabled, hidden, or past eight.
  const slot = useDirectionalLightSlot();
  const lit = props.enabled && slot !== null;

  const cullKey = directionalLightCullKey(props.range_layer_min, props.range_layer_max);
  useRegisterCanvasLight2D(lit, cullKey);
  const layer = useLightClassLayer(cullKey);
  const tintsShadow = props.shadow_enabled && shadowColorContributes(props.shadow_color);
  useRegisterShadowTint(lit && tintsShadow, cullKey);
  const shadowTintLayer = useShadowTintLayer(cullKey);
  const casters = useLightShadowCasters(props.shadow_enabled, props.shadow_item_cull_mask);

  // A disabled light still draws its children: `enabled` switches the light alone.
  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={() =>
        lit ? (
          <DirectionalLightQuads
            props={props}
            layer={layer}
            shadowTintLayer={tintsShadow ? shadowTintLayer : undefined}
            renderOrder={slot}
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
  layer,
  shadowTintLayer,
  renderOrder,
  casters,
}: {
  props: DirectionalLight2DProperties;
  /** The camera layer of this light's class. */
  layer: number;
  /** The albedo-free pass's layer, set only when this light tints its shadow. */
  shadowTintLayer: number | undefined;
  /** This light's slot in the directional list, its draw order within its class. */
  renderOrder: number;
  /** The occluders this light is allowed to see, in world space. */
  casters: readonly WorldShadowCaster[];
}) {
  const { color, energy, blend_mode: blendMode, shadow_filter, shadow_filter_smooth, shadow_color } = props;

  // Held in state, so the view sampler starts once the quad is in the tree: the light's world
  // matrix does not exist before that.
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const shadowed = casters.length > 0;
  const view = useDirectionalShadowView(quad, shadowed, props.max_distance);
  const map = useMemo(
    () => (shadowed && view ? buildDirectionalShadowMap(view, casters) : null),
    [shadowed, view, casters]
  );
  const ndcToShadow = useNdcToShadow(map?.worldToShadow ?? null);

  // One texture for the light's lifetime, filled at commit: a write from a render React discards
  // would reach the materials already on screen.
  const [shadowMap] = useState(createDirectionalShadowTexture);
  useEffect(() => () => shadowMap.dispose(), [shadowMap]);
  useLayoutEffect(() => {
    if (map) writeDirectionalShadowMap(shadowMap, map.bins);
  }, [map, shadowMap]);

  const hasMap = map !== null;
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
  useEffect(() => () => material.dispose(), [material]);

  const shadowMaterial = useMemo(
    () =>
      sampling && shadowTintLayer !== undefined
        ? createDirectionalShadowColorMaterial({ color, energy, blendMode, shadow: sampling })
        : null,
    [sampling, shadowTintLayer, color, energy, blendMode]
  );
  useEffect(() => () => shadowMaterial?.dispose(), [shadowMaterial]);

  return (
    <>
      <FullScreenQuad layer={layer} material={material} renderOrder={renderOrder} onMesh={setQuad} />
      {shadowMaterial && shadowTintLayer !== undefined && (
        <FullScreenQuad layer={shadowTintLayer} material={shadowMaterial} renderOrder={renderOrder} />
      )}
    </>
  );
}
