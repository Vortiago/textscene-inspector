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
import { projectTransparentBackground } from '../../parser/projectSettingsParser';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { SCENE_BUFFER_TYPE, type CompositorPass } from './useCompositorPass';
import { SubscriberStep } from '../frameProfile/FrameProfiler';

/** The composer's `useFrame` priority. A positive one takes the canvas's render over from R3F. */
const COMPOSER_PRIORITY = 1;

interface CompositorProps {
  /** The glow, and the scene buffer's samples, which resolve before the curve as Godot resolves them. */
  pass: CompositorPass;
  /** Null when `adjustment_enabled` is false. */
  adjustments: EnvironmentAdjustments | null;
  toneMapping: EnvironmentSettings['toneMapping'];
  /** The pools `glow_map` resolves in: those of the Environment that names it. */
  resources: SceneResources;
}

export function Compositor({ pass, adjustments, toneMapping, resources }: CompositorProps) {
  const { glow, samples } = pass;
  const { mode, white, exposure, agxContrast } = toneMapping;
  const glowMap = useGlowMap(glow, resources);
  // The composer draws the canvas, which is the root window's surface.
  const transparentBackground = projectTransparentBackground(useProjectSettings().settings);

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
        transparentBackground,
      }) as Effect,
    [glow, adjustments, mode, white, exposure, agxContrast, transparentBackground]
  );
  useEffect(() => () => effect.dispose(), [effect]);
  // A uniform, not an effect rebuild: the map's arrival changes no shader.
  useEffect(() => {
    const toneMap = effect as GodotToneMapEffect;
    if (glowMap) toneMap.setGlowMap(glowMap);
    else toneMap.clearGlowMap();
  }, [effect, glowMap]);

  return (
    <>
      <SubscriberStep step="Compositor" priority={COMPOSER_PRIORITY} />
      <EffectComposer
        multisampling={samples}
        frameBufferType={SCENE_BUFFER_TYPE}
        renderPriority={COMPOSER_PRIORITY}
      >
        <primitive object={effect} dispose={null} />
      </EffectComposer>
    </>
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
