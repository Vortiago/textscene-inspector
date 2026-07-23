/**
 * `<EnvironmentLayer>` — applies one Godot `Environment` to the scene.
 *
 * The single mechanism behind both consumers: an authored `WorldEnvironment`
 * node, and the editor preview environment this previewer supplies to a scene
 * that has none (ADR-0025). They differ only in where the settings come from,
 * so anything that changes how an environment is applied changes both at once.
 *
 * Applies background, sky (as background and/or as the ambient IBL), flat
 * ambient, tonemapping and fog — each restoring what it found on unmount,
 * because the renderer and scene outlive any one environment.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BackgroundMode } from '../../resources/environment/types';
import type { EnvironmentSettings } from '../../resources/environment/renderer';
import { applyToneMapping } from '../../resources/environment/toneMapping';
import { bloomParamsFor } from '../../resources/environment/godotBloom';
import type { SkyProperties } from '../../resources/sky/types';
import { godotColorToLinear } from '../godotColor';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { useOptionalHierarchy } from '../contexts/HierarchyContext';
import { SkyLayer } from '../sky/SkyLayer';
import { GlowLayer } from './GlowLayer';

export interface EnvironmentLayerProps {
  settings: EnvironmentSettings;
  /** The resolved sky, or null when there is none to render. */
  sky: SkyProperties | null;
}

export function EnvironmentLayer({ settings, sky }: EnvironmentLayerProps) {
  // Godot draws the sky as the background under BG_SKY and takes ambient from
  // it whenever the source resolves to a cubemap. The two are independent: a
  // sky can light the scene without being shown (AMBIENT_SOURCE_SKY over a
  // colour background) and can be shown without lighting it (ambient DISABLED).
  const showsSky = settings.background.mode === BackgroundMode.BG_SKY;
  const skyAmbient = settings.skyAmbient;
  const flatAmbient = settings.ambient;
  // Glow is a post-process. When active, the composer owns tonemapping (bloom
  // must read pre-tonemap HDR), so the in-material tonemap path is suppressed to
  // avoid a double tonemap / a `gl.toneMapping` fight with the composer.
  //
  // But the composer is expensive (a mip-blurred HDR pass), and the preview
  // environment enables glow GLOBALLY — so mounting it on every scene, including
  // ones with nothing bright, is pure cost (crippling the headless golden gate
  // under software rendering) for zero visual change: Godot renders a scene with
  // no above-threshold pixels identically with or without glow. So the composer
  // is gated on the scene actually having bloomable content. When it is NOT
  // mounted the scene stays on the ordinary in-material tonemap path, unchanged.
  const glow = settings.glow;
  const bloomThreshold = useMemo(
    () => bloomParamsFor(settings)?.luminanceThreshold ?? Infinity,
    [settings]
  );
  const hasBloomable = useSceneHasBloomableEmissive(bloomThreshold, !!glow);
  const useComposer = !!glow && hasBloomable;

  return (
    <>
      <EnvironmentApplier settings={settings} hasSky={!!sky} suppressToneMapping={useComposer} />
      {useComposer && <GlowLayer settings={settings} />}
      {sky && (showsSky || skyAmbient) && (
        <SkyLayer
          sky={sky}
          asBackground={showsSky}
          backgroundIntensity={settings.background.energyMultiplier}
          intensity={skyAmbient ? skyAmbient.energy * skyAmbient.contribution : 0}
        />
      )}
      {flatAmbient && flatAmbient.energy > 0 && (
        // `* LIGHT_INTENSITY_SCALE` for the same reason a directional light
        // needs it, on the path where it is easiest to miss because Godot
        // writes it most simply: Godot adds `ambient_light * albedo` with no
        // 1/PI, while three's `getAmbientLightIrradiance` returns the colour
        // unscaled and then multiplies by `albedo/PI`.
        //
        // The SKY ambient below does NOT take this factor: three's
        // `getIBLIrradiance` already returns `PI * envColor * intensity`, and
        // that PI cancels against the same Lambert 1/PI. Applying it there too
        // would break the one ambient path that is already right.
        <ambientLight
          color={godotColorToLinear(flatAmbient.color)}
          intensity={flatAmbient.energy * LIGHT_INTENSITY_SCALE}
        />
      )}
    </>
  );
}

/**
 * Whether the live scene has any material bright enough to bloom — a linear
 * emissive whose peak channel × `emissiveIntensity` exceeds the glow threshold
 * (exactly the pixels `GlowLayer`'s peak-channel bright-pass would catch). Only
 * then is mounting the bloom composer worth its cost.
 *
 * Re-checked over a short window after each scene change so async content (GLB,
 * instanced sub-scenes) that mounts a beat later still turns the composer on;
 * it errs toward mounting (a false positive only costs a redundant pass, a false
 * negative would silently drop a real bloom). Diffuse-only brightness — lit
 * white floors, unshaded Label3D text near 1.0 — stays below the threshold and
 * does not trigger it, matching Godot (which does not bloom those either).
 */
function useSceneHasBloomableEmissive(threshold: number, glowEnabled: boolean): boolean {
  const scene = useThree((s) => s.scene);
  const hierarchy = useOptionalHierarchy();
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const [bloomable, setBloomable] = useState(false);

  useEffect(() => {
    if (!glowEnabled) {
      setBloomable(false);
      return undefined;
    }
    const check = () => {
      let found = false;
      scene.traverse((obj) => {
        if (found) return;
        const material = (obj as THREE.Mesh).material;
        const mats = Array.isArray(material) ? material : material ? [material] : [];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          const e = std.emissive;
          const intensity = std.emissiveIntensity ?? 0;
          if (e && intensity > 0 && Math.max(e.r, e.g, e.b) * intensity > threshold) {
            found = true;
            break;
          }
        }
      });
      setBloomable((prev) => (prev === found ? prev : found));
    };
    check();
    const timers = [150, 500, 1100].map((delay) => setTimeout(check, delay));
    return () => timers.forEach(clearTimeout);
  }, [scene, rootKey, threshold, glowEnabled]);

  return bloomable;
}

interface EnvironmentApplierProps {
  settings: EnvironmentSettings;
  /** When a real sky renders, it owns the background and this must not fight it. */
  hasSky: boolean;
  /**
   * When glow is active the bloom composer owns tonemapping (it must read
   * pre-tonemap HDR and forces the renderer to `NoToneMapping`), so the
   * in-material tonemap must NOT be applied here — `GlowLayer`'s tonemap effect
   * does it after bloom instead.
   */
  suppressToneMapping: boolean;
}

function EnvironmentApplier({ settings, hasSky, suppressToneMapping }: EnvironmentApplierProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);

  const mode = settings.background.mode;
  const showBackgroundColor =
    mode === BackgroundMode.BG_COLOR || mode === BackgroundMode.BG_CLEAR_COLOR;

  useEffect(() => {
    const previousBackground = scene.background;
    if (showBackgroundColor) {
      // Godot Color literals are sRGB; convert to three.js's linear working space.
      scene.background = godotColorToLinear(settings.background.color);
    } else if (mode === BackgroundMode.BG_SKY && !hasSky) {
      // A sky we cannot resolve — an unsupported material, or one held in an
      // ExtResource `.tres`. A mid-blue solid keeps the background non-null so
      // the scene still reads as "sky here" rather than as a black void.
      scene.background = godotColorToLinear({ r: 0.5, g: 0.6, b: 0.75 });
    }
    return () => {
      scene.background = previousBackground;
    };
  }, [scene, showBackgroundColor, mode, settings.background.color, hasSky]);

  const { mode: toneMapMode, exposure: toneMapExposure, white: toneMapWhite } =
    settings.toneMapping;
  useEffect(() => {
    if (suppressToneMapping) return undefined;
    return applyToneMapping(
      gl,
      { mode: toneMapMode, exposure: toneMapExposure, white: toneMapWhite },
      scene
    );
  }, [gl, scene, toneMapMode, toneMapExposure, toneMapWhite, suppressToneMapping]);

  const fog = settings.fog;
  useEffect(() => {
    const previousFog = scene.fog;
    if (fog) {
      // Godot screen-space fog → exponential-squared fog (closest THREE match);
      // DEPTH mode (1) is approximated with the same density-based fog.
      scene.fog = new THREE.FogExp2(godotColorToLinear(fog.color).getHex(), fog.density);
    }
    return () => {
      scene.fog = previousFog;
    };
  }, [scene, fog]);

  return null;
}
