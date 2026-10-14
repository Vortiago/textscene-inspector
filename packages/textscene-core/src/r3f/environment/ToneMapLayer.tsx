/**
 * Godot's tonemap pass as a compositor pass: Godot tonemaps the finished colour buffer after the alpha
 * pass (`render_forward_clustered.cpp:2514`, `:2389`), never per fragment. One effect, not bloom then
 * tonemap: `tonemap.glsl` is one shader, and the glow blend sits either side of the curve per mode.
 */

import { useEffect, useMemo } from 'react';
import type { Effect } from 'postprocessing';
import { EffectComposer } from '@react-three/postprocessing';
import type { GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentAdjustments, EnvironmentSettings } from '../../resources/environment/types';
import { useTexture2D } from '../../resources/useTexture2D';
import { useSceneResources } from '../SceneResourcesContext';
import { GodotToneMapEffect } from './GodotToneMapEffect';

export interface ToneMapLayerProps {
  /** Null when the environment has no glow. */
  glow: GlowParams | null;
  /** Null when `adjustment_enabled` is false. */
  adjustments: EnvironmentAdjustments | null;
  toneMapping: EnvironmentSettings['toneMapping'];
}

export function ToneMapLayer({ glow, adjustments, toneMapping }: ToneMapLayerProps) {
  const { mode, white, exposure, agxContrast } = toneMapping;
  const { externalResources, internalResources } = useSceneResources();
  const glowMap = useTexture2D(glow?.map, externalResources, internalResources).texture;

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
        glowMap,
      }) as Effect,
    [glow, adjustments, mode, white, exposure, agxContrast, glowMap]
  );
  useEffect(() => () => effect.dispose(), [effect]);

  // No multisampling: Godot's `msaa_3d` defaults to Disabled (`rendering_server.cpp:3774`), and a
  // resolve here would average edges in linear HDR, before the tone curve.
  return (
    <EffectComposer multisampling={0}>
      <primitive object={effect} dispose={null} />
    </EffectComposer>
  );
}
