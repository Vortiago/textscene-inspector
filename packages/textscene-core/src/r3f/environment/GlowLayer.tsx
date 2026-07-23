/**
 * `<GlowLayer>` — Godot Environment glow as a bloom post-process.
 *
 * Mounted only when the active environment has glow enabled (the editor preview
 * environment does; an authored `WorldEnvironment` may). It takes over the
 * frame with a `postprocessing` composer:
 *
 *   RenderPass (scene → linear HDR)  →  Bloom (bright-pass on HDR)  →  Godot tonemap
 *
 * which is Godot's own order: glow is computed on pre-tonemap HDR luminance,
 * added back, and the whole result is tonemapped. Because the composer disables
 * the renderer's in-material tonemapping while mounted, `EnvironmentApplier`
 * must skip its own tonemap on this path (it does) — otherwise the curve would
 * be applied twice, or fight the composer's `NoToneMapping`.
 *
 * Bloom parameters come from the parsed `glow_*` values (`godotBloom.ts`); the
 * tonemap effect reuses the exact ported Godot curve (`godotToneMapping.ts`).
 *
 * The one place this departs from a stock `BloomEffect`: Godot's glow bright-
 * pass gates on the PEAK RGB channel, not Rec. 709 luminance. A saturated blue
 * emissive (blue ≈ 2.3 pre-tonemap, luma ≈ 0.33) blooms in Godot but is the
 * DIMMEST surface by luminance — no luminance threshold can bloom it without
 * also blooming a lit white floor. So the effect's luminance discriminator is
 * swapped for `max(r, g, b)`, which separates emissive-above-1 from lit-diffuse-
 * below-1 exactly as Godot's HDR threshold does (measured against a Godot
 * render: sphere peak 2.3 blooms, white floor peak 0.67 stays crisp).
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import { BloomEffect, type Effect } from 'postprocessing';
import type { EnvironmentSettings } from '../../resources/environment/renderer';
import { bloomParamsFor } from '../../resources/environment/godotBloom';
import { warn } from '../../logger';
import { gateBloomOnPeakChannel } from './bloomPeakChannel';
import { GodotToneMappingEffect } from './GodotToneMappingEffect';

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
  const params = useMemo(() => bloomParamsFor(settings), [settings]);
  const glReady = useMemo(() => hasRealGlContext(gl), [gl]);

  const bloomEffect = useMemo<BloomEffect | null>(() => {
    if (!params) return null;
    const effect = new BloomEffect({
      luminanceThreshold: params.luminanceThreshold,
      luminanceSmoothing: params.luminanceSmoothing,
      intensity: params.intensity,
      radius: params.radius,
      mipmapBlur: params.mipmapBlur,
    });
    if (!gateBloomOnPeakChannel(effect.luminanceMaterial)) {
      warn(
        '[Glow] postprocessing LuminanceMaterial shader changed shape; glow bright-pass ' +
          'still gates on Rec.709 luminance, so saturated emissives may under-bloom.'
      );
    }
    return effect;
  }, [params]);
  useEffect(() => () => bloomEffect?.dispose(), [bloomEffect]);

  const { mode, exposure, white } = settings.toneMapping;
  // Typed as the base `Effect`: with the library's `declaration: true`, a class
  // extending postprocessing's `Effect` does not carry its inherited members
  // across a module boundary (the base's event-map type is not nameable in the
  // emitted `.d.ts`). The instance is still a `GodotToneMappingEffect`.
  const toneEffect = useMemo<Effect>(
    () => new GodotToneMappingEffect({ mode, exposure, white }),
    [mode, exposure, white]
  );
  useEffect(() => () => toneEffect.dispose(), [toneEffect]);

  if (!bloomEffect || !glReady) return null;

  return (
    <EffectComposer>
      <primitive object={bloomEffect} dispose={null} />
      <primitive object={toneEffect} dispose={null} />
    </EffectComposer>
  );
}
