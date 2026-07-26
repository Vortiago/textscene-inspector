/**
 * `<GlowLayer>` — Godot Environment glow as a compositor pass.
 *
 * Mounted by `EnvironmentLayer` only once it has decided the glow can change the
 * frame, so this takes the resolved params rather than re-deriving them: the
 * "can this glow do anything" question has one answer, at the mount site.
 *
 *   RenderPass (scene → linear HDR)  →  GodotGlowEffect
 *
 * One effect, not a bloom pass followed by a tonemap pass, because Godot's
 * `tonemap.glsl` is itself one shader that gathers the glow pyramid, blends it,
 * and applies the tone curve — and the blend sits on a DIFFERENT side of the tone
 * curve depending on the blend mode. Because the composer disables the renderer's
 * in-material tonemapping while mounted, `EnvironmentApplier` must skip its own
 * tonemap on this path (it does) — the effect applies the same ported curve.
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import type { Effect } from 'postprocessing';
import type { GlowParams } from '../../resources/environment/godotGlow';
import type { EnvironmentSettings } from '../../resources/environment/renderer';
import { GodotGlowEffect } from './GodotGlowEffect';

export interface GlowLayerProps {
  /** Resolved by `EnvironmentLayer`, which has already checked it can bloom. */
  glow: GlowParams;
  toneMapping: EnvironmentSettings['toneMapping'];
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

export function GlowLayer({ glow, toneMapping }: GlowLayerProps) {
  const gl = useThree((s) => s.gl);
  const glReady = useMemo(() => hasRealGlContext(gl), [gl]);
  const { mode, exposure, white } = toneMapping;

  // Typed as the base `Effect`: with the library's `declaration: true`, a class
  // extending postprocessing's `Effect` does not carry its inherited members
  // across a module boundary (the base's event-map type is not nameable in the
  // emitted `.d.ts`). The instance is still a `GodotGlowEffect`.
  const glowEffect = useMemo<Effect>(
    () =>
      new GodotGlowEffect({
        glow,
        toneMapMode: mode,
        toneMapExposure: exposure,
        toneMapWhite: white,
      }) as Effect,
    [glow, mode, exposure, white]
  );
  useEffect(() => () => glowEffect.dispose(), [glowEffect]);

  if (!glReady) return null;

  return (
    <EffectComposer>
      <primitive object={glowEffect} dispose={null} />
    </EffectComposer>
  );
}
