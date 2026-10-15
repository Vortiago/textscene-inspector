/**
 * Godot's tonemap pass as a compositor pass: Godot tonemaps the finished colour buffer after the alpha
 * pass (`render_forward_clustered.cpp:2514`, `:2389`), never per fragment. One effect, not bloom then
 * tonemap: `tonemap.glsl` is one shader, and the glow blend sits either side of the curve per mode.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Effect } from 'postprocessing';
import { EffectComposer } from '@react-three/postprocessing';
import { samplesGlowMap, type GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentAdjustments, EnvironmentSettings } from '../../resources/environment/types';
import { useTexture2D } from '../../resources/useTexture2D';
import { releaseBoundTexture } from '../../resources/textures/applyTextureState';
import type { SceneResources } from '../SceneResourcesContext';
import { GodotToneMapEffect, glowMapView } from './GodotToneMapEffect';
import { SCENE_BUFFER_TYPE } from './compositorPass';

interface ToneMapLayerProps {
  /** Null when the environment has no glow. */
  glow: GlowParams | null;
  /** The scene buffer's samples per pixel, resolved before the tone curve, as Godot resolves it. */
  samples: number;
  /** Null when `adjustment_enabled` is false. */
  adjustments: EnvironmentAdjustments | null;
  toneMapping: EnvironmentSettings['toneMapping'];
  /** The pools `glow_map` resolves in: those of the Environment that names it. */
  resources: SceneResources;
}

export function ToneMapLayer({ glow, samples, adjustments, toneMapping, resources }: ToneMapLayerProps) {
  const { mode, white, exposure, agxContrast } = toneMapping;
  const glowMap = useGlowMap(glow, resources);

  // Typed as the base `Effect`: with the library's `declaration: true`, a class
  // extending postprocessing's `Effect` does not carry its inherited members
  // across a module boundary (the base's event-map type is not nameable in the
  // emitted `.d.ts`). The instance is still a `GodotToneMapEffect`.
  const effect = useMemo<Effect>(
    () =>
      new GodotToneMapEffect({
        glow,
        adjustments,
        toneMapping: { mode, white, agxContrast },
        exposure,
      }) as Effect,
    [glow, adjustments, mode, white, exposure, agxContrast]
  );
  useEffect(() => () => effect.dispose(), [effect]);
  // A uniform, not an effect rebuild: the map's arrival changes no shader.
  useEffect(() => {
    const toneMap = effect as GodotToneMapEffect;
    if (glowMap) toneMap.setGlowMap(glowMap);
    else toneMap.clearGlowMap();
  }, [effect, glowMap]);

  return (
    <EffectComposer multisampling={samples} frameBufferType={SCENE_BUFFER_TYPE}>
      <primitive object={effect} dispose={null} />
    </EffectComposer>
  );
}

/**
 * The glow map's sampled view, or null while it loads and when the composite samples no map, so
 * an unsampled map never loads.
 */
function useGlowMap(glow: GlowParams | null, resources: SceneResources): THREE.Texture | null {
  const ref = glow && samplesGlowMap(glow) ? glow.map : undefined;
  const loaded = useTexture2D(ref, resources.externalResources, resources.internalResources).texture;
  const view = useMemo(() => (loaded ? glowMapView(loaded) : null), [loaded]);
  useEffect(() => () => releaseBoundTexture(view), [view]);
  return view;
}
