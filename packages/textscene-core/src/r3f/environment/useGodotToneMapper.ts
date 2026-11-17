import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentAdjustments, EnvironmentSettings } from '../../resources/environment/types';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import { projectGlowUsesBicubicUpscale } from '../../parser/projectSettingsParser';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { useTextureView } from '../useTextureView';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { GLOW_MAP_SAMPLER, GodotToneMapper } from './GodotToneMapper';

export interface ToneMapperInputs {
  /** Null when the environment has no glow. */
  glow: GlowParams | null;
  /** Null when `adjustment_enabled` is false. */
  adjustments: EnvironmentAdjustments | null;
  toneMapping: EnvironmentSettings['toneMapping'];
  /** Null when the camera attributes hold no auto exposure. */
  autoExposure: AutoExposure | null;
  /** Whether the pass writes the buffer's alpha through, which only a transparent viewport shows. */
  transparentBackground: boolean;
  /** The viewport's `use_debanding`. */
  usesDebanding: boolean;
  /** The texture `glow_map` names, null while it loads and when the composite samples no map. */
  glowMap: THREE.Texture | null;
}

/** The tone mapper for `inputs`, rebuilt when one changes. The hook owns it and disposes it. */
export function useGodotToneMapper(inputs: ToneMapperInputs): GodotToneMapper {
  const { glow, adjustments, toneMapping, autoExposure, transparentBackground, usesDebanding } = inputs;
  const { mode, white, exposure, agxContrast } = toneMapping;
  const glowMap = useTextureView(inputs.glowMap, GLOW_MAP_SAMPLER);
  const usesBicubicGlowUpscale = projectGlowUsesBicubicUpscale(useProjectSettings().settings);

  const toneMapper = useMemo(
    () =>
      new GodotToneMapper({
        glow,
        adjustments,
        autoExposure,
        toneMapping: { mode, white, agxContrast },
        exposure,
        transparentBackground,
        usesBicubicGlowUpscale,
        usesDebanding,
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
      usesDebanding,
    ]
  );
  useDisposeOnRelease(toneMapper);
  // A uniform, not a rebuild: the map's arrival changes no shader.
  useEffect(() => {
    if (glowMap) toneMapper.setGlowMap(glowMap);
    else toneMapper.clearGlowMap();
  }, [toneMapper, glowMap]);
  return toneMapper;
}
