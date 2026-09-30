/**
 * `<PreviewLighting>`: Godot's editor preview sun and environment, each mounted
 * only while the scene supplies none (ADR-0025). It reads the live tree, so a
 * node inside an instanced sub-scene counts, as in Godot's editor.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useViewportMode } from '../contexts/ViewportModeContext';
import { useLiveSceneNodes } from '../useLiveSceneTree';
import { EnvironmentLayer } from '../environment/EnvironmentLayer';
import { LIGHT_INTENSITY_SCALE, PREVIEW_SUN_DEPTH_BIAS } from '../lightConstants';
import {
  DIRECTIONAL_SHADOW_BLEND_SPLITS_DEFAULT,
  DIRECTIONAL_SHADOW_FADE_START_DEFAULT,
  DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
  DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT,
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
  DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT,
  DirectionalShadowMode,
  directionalShadowSplitCount,
} from '../../godot/directionalShadow';
import { directionalShadowUserData } from '../directionalShadow/declaration';
import {
  PREVIEW_SUN_COLOR,
  PREVIEW_SUN_ENERGY,
  PREVIEW_SUN_SHADOW_MAX_DISTANCE,
  YIELDS_A_PREVIEW,
  previewEnvironment,
  previewSunDirection,
  previewYield,
} from './godotPreviewLighting';


/**
 * Where the preview sun stands. It has no scene node, so nothing is anchored to
 * its transform and the distance is free. Only the direction it lights from
 * counts, since the scene's shadow fitter places the shadow box.
 */
const PREVIEW_SUN_DISTANCE = 30;

/**
 * The preview sun's declaration: the editor sets its max distance
 * (`node_3d_editor_plugin.cpp:9476`) and four splits (`:10383`), so the
 * pancake, fade start, normal bias, split offsets and blending keep the
 * class defaults.
 */
const PREVIEW_SUN_SHADOW = directionalShadowUserData({
  maxDistance: PREVIEW_SUN_SHADOW_MAX_DISTANCE,
  pancakeSize: DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT,
  fadeStart: DIRECTIONAL_SHADOW_FADE_START_DEFAULT,
  depthBias: PREVIEW_SUN_DEPTH_BIAS,
  normalBias: DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
  splitCount: directionalShadowSplitCount(DirectionalShadowMode.PARALLEL_4_SPLITS),
  splitOffsets: DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT,
  blendSplits: DIRECTIONAL_SHADOW_BLEND_SPLITS_DEFAULT,
});

export function PreviewLighting() {
  const { showPreviewSun, showPreviewEnvironment } = useViewportMode();
  const yielding = useLiveSceneNodes(YIELDS_A_PREVIEW);

  const decision = useMemo(
    () =>
      previewYield(
        yielding.map((entry) => entry.node.type),
        { sun: showPreviewSun, environment: showPreviewEnvironment }
      ),
    [yielding, showPreviewSun, showPreviewEnvironment]
  );

  return (
    <>
      {decision.sun && <PreviewSun />}
      {decision.environment && <PreviewEnvironment />}
    </>
  );
}

/**
 * Godot's preview sun: a white, energy-1.0 DirectionalLight3D with shadows on.
 * Built from the same constants an authored `<DirectionalLight3D>` uses and
 * fitted by the same system, so a scene does not visibly change character the
 * moment it gains its own sun.
 */
function PreviewSun() {
  const target = useMemo(() => new THREE.Object3D(), []);
  // A tuple, not a Vector3: R3F assigns an object-valued `position` straight
  // onto the instance, and `Object3D.position` has no setter.
  const position = useMemo((): [number, number, number] => {
    const { x, y, z } = previewSunDirection().multiplyScalar(-PREVIEW_SUN_DISTANCE);
    return [x, y, z];
  }, []);

  return (
    <>
      <primitive object={target} />
      <directionalLight
        position={position}
        target={target}
        color={PREVIEW_SUN_COLOR}
        intensity={PREVIEW_SUN_ENERGY * LIGHT_INTENSITY_SCALE}
        castShadow
        shadow-mapSize-width={DIRECTIONAL_SHADOW_SIZE_DEFAULT}
        shadow-mapSize-height={DIRECTIONAL_SHADOW_SIZE_DEFAULT}
        userData={PREVIEW_SUN_SHADOW}
      />
    </>
  );
}

/** Godot's preview environment, applied through the same layer an authored one uses. */
function PreviewEnvironment() {
  const { settings, sky } = useMemo(() => previewEnvironment(), []);
  return <EnvironmentLayer settings={settings} sky={sky} />;
}
