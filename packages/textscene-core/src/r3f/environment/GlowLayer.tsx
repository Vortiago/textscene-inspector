/**
 * `<GlowLayer>` — Godot Environment glow as a compositor pass.
 *
 * Mounted only when the active environment has glow enabled (the editor preview
 * environment does; an authored `WorldEnvironment` may). It takes over the frame
 * with a `postprocessing` composer:
 *
 *   RenderPass (scene → linear HDR)  →  GodotGlowEffect
 *
 * One effect, not a bloom pass followed by a tonemap pass, because Godot's
 * `tonemap.glsl` is itself one shader that gathers the glow pyramid, blends it,
 * and applies the tone curve — and the blend sits on a DIFFERENT side of the tone
 * curve depending on the blend mode. Because the composer disables the renderer's
 * in-material tonemapping while mounted, `EnvironmentApplier` must skip its own
 * tonemap on this path (it does) — the effect applies the same ported curve.
 *
 * Every glow knob comes from the parsed `glow_*` values (`godotGlow.ts`).
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import type { Effect } from 'postprocessing';
import type { EnvironmentSettings } from '../../resources/environment/renderer';
import { glowParamsFor } from '../../resources/environment/godotGlow';
import { GodotGlowEffect } from './GodotGlowEffect';

export interface GlowLayerProps {
  settings: EnvironmentSettings;
}

/**
 * The `postprocessing` composer needs a real WebGL context at construction (it
 * reads the drawing-buffer attributes). Under `@react-three/test-renderer` and
 * any SSR/headless-DOM mount there is none, so glow no-ops there rather than
 * throwing — the previewer still renders, just without bloom.
 */
function hasRealGlContext(gl: { getContext?: () => unknown }): boolean {
  try {
    const ctx = gl.getContext?.() as { getContextAttributes?: () => unknown } | null;
    return !!ctx && typeof ctx.getContextAttributes === 'function' && !!ctx.getContextAttributes();
  } catch {
    return false;
  }
}

export function GlowLayer({ settings }: GlowLayerProps) {
  const gl = useThree((s) => s.gl);
  const params = useMemo(() => glowParamsFor(settings), [settings]);
  const glReady = useMemo(() => hasRealGlContext(gl), [gl]);

  const { mode, exposure, white } = settings.toneMapping;
  // Typed as the base `Effect`: with the library's `declaration: true`, a class
  // extending postprocessing's `Effect` does not carry its inherited members
  // across a module boundary (the base's event-map type is not nameable in the
  // emitted `.d.ts`). The instance is still a `GodotGlowEffect`.
  const glowEffect = useMemo<Effect | null>(() => {
    if (!params) return null;
    return new GodotGlowEffect({
      glow: params,
      toneMapMode: mode,
      toneMapExposure: exposure,
      toneMapWhite: white,
    }) as Effect;
  }, [params, mode, exposure, white]);
  useEffect(() => () => glowEffect?.dispose(), [glowEffect]);

  if (!glowEffect || !glReady) return null;

  return (
    <EffectComposer>
      <primitive object={glowEffect} dispose={null} />
    </EffectComposer>
  );
}
