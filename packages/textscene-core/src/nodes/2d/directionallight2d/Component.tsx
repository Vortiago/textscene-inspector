/**
 * DirectionalLight2D draws nothing on the canvas, as in Godot: it adds one term over the whole
 * accumulation buffer every lit canvas item multiplies its albedo against
 * (`r3f/lighting2d/CanvasLighting2D`). Its class reaches every item on its canvas layers, and
 * its shadow samples a parallel map (`directionalShadowMap.ts`) built over the view.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
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
import { useDirectionalShadowView } from '../../../r3f/lighting2d/directionalShadowView';
import {
  createDirectionalLightMaterial,
  createDirectionalShadowColorMaterial,
  updateDirectionalShadowTexture,
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
        lit && slot !== null ? (
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

/** One full-screen quad on a light layer, drawn before the visible pass reads the accumulator. */
function AccumulationQuad({
  meshRef,
  material,
  renderOrder,
}: {
  meshRef: (mesh: THREE.Mesh | null) => void;
  material: THREE.Material;
  renderOrder: number;
}) {
  return (
    <mesh
      ref={meshRef}
      material={material}
      renderOrder={renderOrder}
      // The quad ignores every matrix, so its bounds say nothing about where it lands.
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
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

  // A callback ref, so the view sampler starts once the quad is in the tree: the light's world
  // matrix does not exist before that.
  const [quad, setQuad] = useState<THREE.Mesh | null>(null);
  const shadowed = casters.length > 0;
  const view = useDirectionalShadowView(quad, shadowed, props.max_distance);
  const map = useMemo(
    () => (shadowed && view ? buildDirectionalShadowMap(view, casters) : null),
    [shadowed, view, casters]
  );

  // The texture and the transform outlive each rebuild, since a pan or a turning light rebuilds
  // the map every frame. Both are written at commit: a write from a render React discards would
  // reach the materials already on screen.
  const ndcToShadow = useRef(new THREE.Matrix3()).current;
  const [shadowMap, setShadowMap] = useState<THREE.DataTexture | null>(null);
  useLayoutEffect(() => {
    if (!map) {
      setShadowMap(null);
      return;
    }
    const [m00, m01, m02, m10, m11, m12] = map.ndcToShadow;
    ndcToShadow.set(m00, m01, m02, m10, m11, m12, 0, 0, 1);
    const next = updateDirectionalShadowTexture(shadowMap, map.bins);
    if (next !== shadowMap) setShadowMap(next);
  }, [map, shadowMap, ndcToShadow]);
  useEffect(() => () => shadowMap?.dispose(), [shadowMap]);

  const sampling = useMemo<DirectionalShadowSampling | undefined>(
    () =>
      shadowMap
        ? {
            map: shadowMap,
            filter: shadow_filter,
            smooth: shadow_filter_smooth,
            ndcToShadow,
            shadowColor: shadow_color,
          }
        : undefined,
    [shadowMap, shadow_filter, shadow_filter_smooth, ndcToShadow, shadow_color]
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

  // The light layer keeps the quad out of the visible pass and sorts it into its class.
  const toLightQuad = useCallback(
    (mesh: THREE.Mesh | null) => {
      mesh?.layers.set(layer);
      setQuad(mesh);
    },
    [layer]
  );
  const toShadowTintLayer = useCallback(
    (mesh: THREE.Mesh | null) => {
      if (shadowTintLayer !== undefined) mesh?.layers.set(shadowTintLayer);
    },
    [shadowTintLayer]
  );

  return (
    <>
      <AccumulationQuad meshRef={toLightQuad} material={material} renderOrder={renderOrder} />
      {shadowMaterial && (
        <AccumulationQuad meshRef={toShadowTintLayer} material={shadowMaterial} renderOrder={renderOrder} />
      )}
    </>
  );
}
