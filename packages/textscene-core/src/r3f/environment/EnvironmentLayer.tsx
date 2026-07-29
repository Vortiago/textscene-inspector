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

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { BackgroundMode } from '../../resources/environment/types';
import type { EnvironmentSettings } from '../../resources/environment/renderer';
import { applyToneMapping } from '../../resources/environment/toneMapping';
import {
  unexposedBrightPassThreshold,
  glowNeedsEveryPixel,
  glowParamsFor,
} from '../../resources/environment/godotGlow';
import type { SkyProperties } from '../../resources/sky/types';
import { godotColorToLinear } from '../godotColor';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { useOptionalHierarchy } from '../contexts/HierarchyContext';
import { sceneHasBloomableEmissive } from './bloomableScan';
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
  // Glow is a post-process, and the effect that runs it owns the tone curve too
  // (Godot's own tonemap shader gathers, blends and tonemaps in one), so the
  // in-material tonemap path is suppressed while it is mounted.
  //
  // But the composer is expensive (a mip-blurred HDR pass), and the preview
  // environment enables glow GLOBALLY — so mounting it on every scene, including
  // ones with nothing bright, is pure cost (crippling the headless golden gate
  // under software rendering) for zero visual change: Godot renders a scene with
  // no above-threshold pixels identically with or without glow. So the composer
  // is gated on the scene actually having bloomable content. When it is NOT
  // mounted the scene stays on the ordinary in-material tonemap path, unchanged.
  const glowParams = useMemo(() => glowParamsFor(settings), [settings]);
  // null when scanning the scene cannot decide the question: either nothing could
  // glow, or the settings glow every pixel regardless of what the scene holds. One
  // nullable argument rather than a threshold plus a flag, because a threshold of 0
  // means "everything blooms" and would be actively wrong if the flag were dropped.
  const scanThreshold =
    glowParams && !glowNeedsEveryPixel(glowParams)
      ? unexposedBrightPassThreshold(glowParams)
      : null;
  const hasBloomable = useSceneHasBloomableEmissive(scanThreshold);
  const activeGlow = glowParams && (scanThreshold === null || hasBloomable) ? glowParams : null;

  return (
    <>
      <EnvironmentApplier settings={settings} hasSky={!!sky} suppressToneMapping={!!activeGlow} />
      {activeGlow && <GlowLayer glow={activeGlow} toneMapping={settings.toneMapping} />}
      {sky && (showsSky || skyAmbient) && (
        <>
          <SkyLayer
            sky={sky}
            asBackground={showsSky}
            backgroundIntensity={settings.background.energyMultiplier}
            // The sky's REFLECTION strength drives `environmentIntensity`. Godot
            // reflects the sky at `background_energy_multiplier` whatever the
            // ambient source, so this is the full energy, not the diffuse-scaled
            // one; the diffuse share is restored per-material below.
            intensity={skyAmbient ? skyAmbient.energy : 0}
          />
          <SkyDiffuseReflectionSplit
            contribution={skyAmbient ? skyAmbient.contribution : 1}
            active={!!skyAmbient}
          />
        </>
      )}
      {flatAmbient && flatAmbient.energy > 0 && (
        // `* LIGHT_INTENSITY_SCALE` for the same reason a directional light
        // needs it, on the path where it is easiest to miss because Godot
        // writes it most simply: Godot adds `ambient_light * albedo` with no
        // 1/PI, while three's `getAmbientLightIrradiance` returns the colour
        // unscaled and then multiplies by `albedo/PI`.
        //
        // The SKY ambient above does NOT take this factor: three's
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
 * Restores Godot's separation of sky DIFFUSE from sky REFLECTION, which three
 * couples under one `scene.environmentIntensity`. Godot scales the diffuse
 * ambient by `ambient_light_sky_contribution` while a metal reflects the whole
 * sky regardless; three applies the single intensity to both. With
 * `environmentIntensity` set to the full REFLECTION strength (in `SkyLayer`),
 * each material's `envMapIntensity` is pulled back toward the diffuse
 * contribution by how dielectric it is:
 *
 *   envMapIntensity = contribution + metalness · (1 − contribution)
 *
 * A full metal (metalness 1) keeps the whole reflection; a rough dielectric
 * (metalness 0) keeps only `contribution` of the sky — 0 under a COLOR ambient,
 * so it falls back to the flat ambient alone, exactly as Godot leaves it. This
 * is the `envMapIntensity` split.
 *
 * A no-op at `contribution >= 1` (the common case where the two already agree),
 * so it never touches a material unless a scene lowers the sky contribution.
 * Re-applied over a short window like the bloom probe below, so materials that
 * mount a beat later (GLB, instanced sub-scenes) are caught; originals are
 * restored on unmount because the renderer outlives any one environment.
 */
function SkyDiffuseReflectionSplit({
  contribution,
  active,
}: {
  contribution: number;
  active: boolean;
}) {
  const scene = useThree((s) => s.scene);
  const originals = useRef(
    new Map<THREE.MeshStandardMaterial, { envMap: THREE.Texture | null; intensity: number }>()
  );

  // Applied every frame rather than once on mount: materials arrive across
  // several frames (async textures force a fresh material, GLB and instanced
  // sub-scenes mount late), and the assignment is idempotent, so re-stamping
  // each frame is the robust way to catch them all without chasing mount order.
  //
  // three IGNORES a material's `envMapIntensity` while the IBL comes from
  // `scene.environment` — the renderer overrides that uniform with
  // `scene.environmentIntensity` unless the material owns its `envMap`
  // (WebGLRenderer, `material.envMap === null && scene.environment !== null`).
  // So the split is bought by pointing each material's own `envMap` at the sky
  // (the same PMREM texture, same mapping — no recompile) and then setting its
  // per-material intensity.
  useFrame(() => {
    if (!active || contribution >= 1) return;
    const environment = scene.environment;
    if (!environment) return;
    scene.traverse((obj) => {
      const material = (obj as THREE.Mesh).material;
      const mats = Array.isArray(material) ? material : material ? [material] : [];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (typeof std.envMapIntensity !== 'number') continue;
        if (!originals.current.has(std)) {
          originals.current.set(std, { envMap: std.envMap, intensity: std.envMapIntensity });
        }
        std.envMap = environment;
        const metalness = std.metalness ?? 0;
        std.envMapIntensity = contribution + metalness * (1 - contribution);
      }
    });
  });

  // Restore what was found when this environment goes away — the renderer and
  // its materials outlive any one environment.
  useEffect(() => {
    const captured = originals.current;
    return () => {
      for (const [mat, orig] of captured) {
        mat.envMap = orig.envMap;
        mat.envMapIntensity = orig.intensity;
      }
      captured.clear();
    };
  }, [contribution, active]);

  return null;
}

/**
 * Whether the live scene has any material bright enough to bloom, and therefore
 * whether mounting the compositor is worth its cost. What counts as bright enough
 * is `sceneHasBloomableEmissive`'s to define; this owns only what that cannot know.
 *
 * Re-checked over a short window after each scene change so async content (GLB,
 * instanced sub-scenes) that mounts a beat later still turns the composer on;
 * it errs toward mounting (a false positive only costs a redundant pass, a false
 * negative would silently drop a real bloom), and having said so it LATCHES —
 * once something has bloomed, the answer stays true until the scene changes.
 *
 * A null threshold means the scan cannot decide and is skipped — there is no glow,
 * or the settings glow every pixel whatever the scene holds.
 */
function useSceneHasBloomableEmissive(threshold: number | null): boolean {
  const scene = useThree((s) => s.scene);
  const hierarchy = useOptionalHierarchy();
  const rootKey = hierarchy?.sceneGraph?.rootScene ?? '';
  const [bloomable, setBloomable] = useState(false);

  useEffect(() => {
    // Clear on every re-run, not just when the scan is switched off: the deps
    // below include the scene and its root, so a different scene must start from
    // "nothing bloomed yet" rather than inherit the previous scene's latch.
    setBloomable(false);
    if (threshold === null) return undefined;
    const check = () => {
      const found = sceneHasBloomableEmissive(scene, threshold);
      // LATCHES, and only resets when the deps below change. Mounting the
      // composer flips `gl.toneMapping` to `NoToneMapping`, which is part of
      // three's program-cache key for every tone-mapped material — so each
      // change of answer recompiles the whole scene's shaders. Content that
      // settles across the probe window could otherwise flip this several times
      // during one load. Latching caps that at one, and costs only a redundant
      // pass in the case this hook already documents itself as erring toward.
      if (found) setBloomable(true);
    };
    check();
    const timers = [150, 500, 1100].map((delay) => setTimeout(check, delay));
    return () => timers.forEach(clearTimeout);
  }, [scene, rootKey, threshold]);

  return bloomable;
}

interface EnvironmentApplierProps {
  settings: EnvironmentSettings;
  /** When a real sky renders, it owns the background and this must not fight it. */
  hasSky: boolean;
  /**
   * The composer forces the renderer to `NoToneMapping` while mounted, and
   * `GodotGlowEffect` applies the same ported curve itself — so the in-material
   * tonemap must NOT also be applied here.
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
