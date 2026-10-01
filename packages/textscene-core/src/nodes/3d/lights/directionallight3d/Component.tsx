/**
 * <DirectionalLight3D>: a parallel light in a transform group, aimed at a target at local -Z. It
 * declares its shadow and leaves the boxes and splits to the scene's `<DirectionalShadowFitter>`,
 * as Godot fits a directional shadow to the camera and not to the light. The fitter also sizes its
 * shadow map from its share of Godot's atlas. A mode with no split casts nothing, as Godot sets up
 * no shadow map for it.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DirectionalLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import {
  DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT,
  DIRECTIONAL_SHADOW_BLEND_SPLITS_DEFAULT,
  DIRECTIONAL_SHADOW_FADE_START_DEFAULT,
  DIRECTIONAL_SHADOW_MAX_DISTANCE_DEFAULT,
  DIRECTIONAL_SHADOW_MODE_DEFAULT,
  DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
  DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT,
  DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT,
  directionalShadowSplitCount,
  sharesDirectionalShadowAtlas,
} from '../../../../godot/directionalShadow';
import { directionalShadowUserData } from '../../../../r3f/directionalShadow/declaration';
import { directionalShadowBias } from '../shared/shadowBias';
import { LightWithTarget } from '../shared/lightShared';
import { DirectionalLightGizmo } from '../shared/lightHelpers';

export function DirectionalLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as DirectionalLight3DProperties;
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const intensity = properties.light_energy * LIGHT_INTENSITY_SCALE;
  const splitCount = directionalShadowSplitCount(
    properties.directional_shadow_mode ?? DIRECTIONAL_SHADOW_MODE_DEFAULT
  );
  const shadowUserData = useMemo(
    () =>
      directionalShadowUserData({
        maxDistance: properties.directional_shadow_max_distance ?? DIRECTIONAL_SHADOW_MAX_DISTANCE_DEFAULT,
        pancakeSize: properties.directional_shadow_pancake_size ?? DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT,
        fadeStart: properties.directional_shadow_fade_start ?? DIRECTIONAL_SHADOW_FADE_START_DEFAULT,
        depthBias: directionalShadowBias(properties.shadow_bias, properties.shadow_blur),
        normalBias: properties.shadow_normal_bias ?? DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
        splitCount,
        splitOffsets: [
          properties.directional_shadow_split_1 ?? DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT[0],
          properties.directional_shadow_split_2 ?? DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT[1],
          properties.directional_shadow_split_3 ?? DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT[2],
        ],
        blendSplits: properties.directional_shadow_blend_splits ?? DIRECTIONAL_SHADOW_BLEND_SPLITS_DEFAULT,
        sharesAtlas: sharesDirectionalShadowAtlas(
          properties.shadow_enabled,
          properties.sky_mode ?? DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT
        ),
      }),
    [properties, splitCount]
  );

  return (
    <LightWithTarget
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      renderLight={(target) => (
        <>
          <directionalLight
            ref={lightRef}
            position={[0, 0, 0]}
            color={color}
            intensity={intensity}
            castShadow={properties.shadow_enabled && splitCount > 0}
            userData={shadowUserData}
            target={target}
          />
          <DirectionalLightGizmo lightRef={lightRef} />
        </>
      )}
    >
      {children}
    </LightWithTarget>
  );
}
