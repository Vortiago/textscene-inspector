/**
 * Godot's tonemap pass as one `GodotToneMapEffect` for a viewport: built from the Environment and
 * the camera attributes its world renders with, with the glow map bound once it loads. The root
 * canvas's compositor and a SubViewport's pass each own one.
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { samplesGlowMap, type GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentAdjustments, EnvironmentSettings } from '../../resources/environment/types';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import { useTexture2D } from '../../resources/useTexture2D';
import { projectGlowUsesBicubicUpscale } from '../../parser/projectSettingsParser';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import type { SceneResources } from '../SceneResourcesContext';
import { useTextureView } from '../useTextureView';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { GLOW_MAP_SAMPLER, GodotToneMapEffect } from './GodotToneMapEffect';

export interface ToneMapEffectInputs {
  /** Null when the environment has no glow. */
  glow: GlowParams | null;
  /** Null when `adjustment_enabled` is false. */
  adjustments: EnvironmentAdjustments | null;
  toneMapping: EnvironmentSettings['toneMapping'];
  /** Null when the camera attributes hold no auto exposure. */
  autoExposure: AutoExposure | null;
  /** Whether the pass writes the buffer's alpha through, which only a transparent viewport shows. */
  transparentBackground: boolean;
  /** The pools `glow_map` resolves in: those of the Environment that names it. */
  resources: SceneResources;
}

/** The effect for `inputs`, rebuilt when one changes. The hook owns the effect and disposes it. */
export function useGodotToneMapEffect(inputs: ToneMapEffectInputs): GodotToneMapEffect {
  const { glow, adjustments, toneMapping, autoExposure, transparentBackground, resources } = inputs;
  const { mode, white, exposure, agxContrast } = toneMapping;
  const glowMap = useGlowMap(glow, resources);
  const usesBicubicGlowUpscale = projectGlowUsesBicubicUpscale(useProjectSettings().settings);

  const effect = useMemo(
    () =>
      new GodotToneMapEffect({
        glow,
        adjustments,
        autoExposure,
        toneMapping: { mode, white, agxContrast },
        exposure,
        transparentBackground,
        usesBicubicGlowUpscale,
      }),
    [
      glow,
      adjustments,
      autoExposure,
      mode,
      white,
      exposure,
      agxContrast,
      transparentBackground,
      usesBicubicGlowUpscale,
    ]
  );
  useDisposeOnRelease(effect);
  // A uniform, not an effect rebuild: the map's arrival changes no shader.
  useEffect(() => {
    if (glowMap) effect.setGlowMap(glowMap);
    else effect.clearGlowMap();
  }, [effect, glowMap]);
  return effect;
}

/**
 * The glow map's sampled view, or null while it loads and when the composite samples no map, so
 * an unsampled map never loads.
 */
function useGlowMap(glow: GlowParams | null, resources: SceneResources): THREE.Texture | null {
  const ref = glow && samplesGlowMap(glow) ? glow.map : undefined;
  const loaded = useTexture2D(ref, resources.externalResources, resources.internalResources).texture;
  return useTextureView(loaded, GLOW_MAP_SAMPLER);
}
