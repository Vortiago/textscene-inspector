/**
 * Godot's tonemap pass as a compositor pass: Godot tonemaps the finished colour buffer after the alpha
 * pass (`render_forward_clustered.cpp:2514`, `:2389`), never per fragment. One effect, not bloom then
 * tonemap: `tonemap.glsl` is one shader, and the glow blend sits either side of the curve per mode.
 */

import { useEffect, useMemo } from 'react';
import type { Effect } from 'postprocessing';
import { EffectComposer } from '@react-three/postprocessing';
import type { GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { GodotToneMapEffect } from './GodotToneMapEffect';

export interface ToneMapLayerProps {
  /** Null when the environment has no glow, or nothing in the scene can bloom. */
  glow: GlowParams | null;
  toneMapping: EnvironmentSettings['toneMapping'];
}

export function ToneMapLayer({ glow, toneMapping }: ToneMapLayerProps) {
  const { mode, white, exposure, agxContrast } = toneMapping;

  // Typed as the base `Effect`: with the library's `declaration: true`, a class
  // extending postprocessing's `Effect` does not carry its inherited members
  // across a module boundary (the base's event-map type is not nameable in the
  // emitted `.d.ts`). The instance is still a `GodotToneMapEffect`.
  const effect = useMemo<Effect>(
    () =>
      new GodotToneMapEffect({
        glow,
        toneMapMode: mode,
        toneMapWhite: white,
        toneMapExposure: exposure,
        toneMapAgxContrast: agxContrast,
      }) as Effect,
    [glow, mode, white, exposure, agxContrast]
  );
  useEffect(() => () => effect.dispose(), [effect]);

  return (
    <EffectComposer>
      <primitive object={effect} dispose={null} />
    </EffectComposer>
  );
}
