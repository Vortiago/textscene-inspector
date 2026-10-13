/**
 * Applies one Godot `Environment` to the scene, for an authored `WorldEnvironment` and for the
 * editor preview environment alike (ADR-0025): background, sky, flat ambient, tonemapping, depth
 * fog and volumetric fog.
 * Each restores what it found on unmount, because the renderer and scene outlive an environment.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BackgroundMode, type EnvironmentSettings } from '../../resources/environment/types';
import { applyToneMapping } from '../../resources/environment/toneMapping';
import {
  unexposedBrightPassThreshold,
  glowNeedsEveryPixel,
  glowParamsFor,
} from '../../resources/environment/godotGlow';
import type { SkyProperties } from '../../resources/sky/types';
import { godotColorToLinear } from '../godotColor';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { sceneHasBloomableEmissive } from './bloomableScan';
import { sceneHasBlendedSurface } from './alphaPassScan';
import { useLatchedSceneScan } from './useLatchedSceneScan';
import { SkyLayer } from '../sky/SkyLayer';
import { ToneMapLayer } from './ToneMapLayer';
import { SkyDiffuseReflectionSplit } from './SkyDiffuseReflectionSplit';
import { VolumetricFogLayer } from '../volumetricFog/VolumetricFogLayer';
import { sceneFogFor } from './sceneFog';

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
  const showsColor = showsBackgroundColor(settings.background.mode);
  const skyAmbient = settings.skyAmbient;
  const flatAmbient = settings.ambient;
  // Blending and glow both need linear HDR ahead of the tone curve, so the
  // compositor owns the curve when either is live. The HDR pass is not free, so
  // each is gated on the scene being able to show it.
  const glowParams = useMemo(() => glowParamsFor(settings), [settings]);
  // Null when a scan cannot decide: nothing could glow, or every pixel glows. One nullable value,
  // not a threshold and a flag, since a threshold of 0 means "everything blooms".
  const scanThreshold =
    glowParams && !glowNeedsEveryPixel(glowParams) ? unexposedBrightPassThreshold(glowParams) : null;
  const hasBloomable = useSceneHasBloomableEmissive(scanThreshold);
  const hasBlended = useSceneHasBlendedSurface();
  const activeGlow = glowParams && (scanThreshold === null || hasBloomable) ? glowParams : null;
  const draws3D = useDraws3D();
  // One value decides the pass and the suppression, so they cannot disagree.
  const composited = draws3D && (activeGlow || hasBlended) ? { glow: activeGlow } : null;

  return (
    <>
      <EnvironmentApplier settings={settings} hasSky={!!sky} suppressToneMapping={!!composited} />
      {composited && <ToneMapLayer glow={composited.glow} toneMapping={settings.toneMapping} />}
      {draws3D && settings.volumetricFog && (
        <VolumetricFogLayer
          fog={settings.volumetricFog}
          backgroundColor={showsColor ? settings.background.color : null}
        />
      )}
      {sky && (showsSky || skyAmbient) && (
        <>
          <SkyLayer
            sky={sky}
            asBackground={showsSky}
            backgroundIntensity={settings.background.energyMultiplier}
            // The reflection strength drives `environmentIntensity`: Godot reflects the sky at
            // `background_energy_multiplier` whatever the ambient source. The diffuse share is
            // restored per material below.
            intensity={skyAmbient ? skyAmbient.energy : 0}
          />
          <SkyDiffuseReflectionSplit
            contribution={skyAmbient ? skyAmbient.contribution : 1}
            active={!!skyAmbient}
          />
        </>
      )}
      {flatAmbient && flatAmbient.energy > 0 && (
        // `* LIGHT_INTENSITY_SCALE`: Godot adds `ambient_light * albedo` with no 1/PI, while three
        // multiplies the colour by `albedo/PI`. The sky ambient takes no factor, because
        // `getIBLIrradiance` already returns `PI * envColor * intensity`.
        <ambientLight
          color={godotColorToLinear(flatAmbient.color)}
          intensity={flatAmbient.energy * LIGHT_INTENSITY_SCALE}
        />
      )}
    </>
  );
}

/** A null threshold means no glow, or one that catches every pixel: nothing to scan for. */
function useSceneHasBloomableEmissive(threshold: number | null): boolean {
  return useLatchedSceneScan(
    useMemo(
      () =>
        threshold === null ? null : (scene: THREE.Object3D) => sceneHasBloomableEmissive(scene, threshold),
      [threshold]
    )
  );
}

/** Whether the live scene draws anything through the blend equation. */
function useSceneHasBlendedSurface(): boolean {
  return useLatchedSceneScan(sceneHasBlendedSurface);
}

/**
 * Whether this canvas draws the 3D passes: the tone-map compositor and the volumetric fog. Both need
 * a real GL context, which test-renderer and a headless DOM lack. Godot composites canvas items
 * after `_render_buffers_post_process_and_tonemap`, so a 2D canvas gets neither, and every canvas
 * item there blends.
 */
function useDraws3D(): boolean {
  const gl = useThree((s) => s.gl);
  const glReady = useMemo(() => hasRealGlContext(gl), [gl]);
  const is2D = useCanvasWorkspace() === '2d';
  return glReady && !is2D;
}

function hasRealGlContext(gl: { getContext?: () => unknown }): boolean {
  try {
    const ctx = gl.getContext?.() as { getContextAttributes?: () => unknown } | null;
    return !!ctx && typeof ctx.getContextAttributes === 'function' && !!ctx.getContextAttributes();
  } catch {
    return false;
  }
}

interface EnvironmentApplierProps {
  settings: EnvironmentSettings;
  /** When a real sky renders, it owns the background and this must not fight it. */
  hasSky: boolean;
  /**
   * The composer forces `NoToneMapping` while mounted and `GodotToneMapEffect` applies the curve,
   * so the in-material tonemap is not applied here.
   */
  suppressToneMapping: boolean;
}

function EnvironmentApplier({ settings, hasSky, suppressToneMapping }: EnvironmentApplierProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);

  const mode = settings.background.mode;
  const showBackgroundColor = showsBackgroundColor(mode);

  useEffect(() => {
    const previousBackground = scene.background;
    if (showBackgroundColor) {
      // Godot Color literals are sRGB; convert to three.js's linear working space.
      scene.background = godotColorToLinear(settings.background.color);
    } else if (mode === BackgroundMode.BG_SKY && !hasSky) {
      // A sky we cannot resolve (an unsupported material, or one in an ExtResource `.tres`). A
      // mid-blue solid reads as "sky here" rather than as a black void.
      scene.background = godotColorToLinear({ r: 0.5, g: 0.6, b: 0.75 });
    }
    return () => {
      scene.background = previousBackground;
    };
  }, [scene, showBackgroundColor, mode, settings.background.color, hasSky]);

  const {
    mode: toneMapMode,
    exposure: toneMapExposure,
    white: toneMapWhite,
    agxContrast: toneMapAgxContrast,
  } = settings.toneMapping;
  useEffect(() => {
    if (suppressToneMapping) return undefined;
    return applyToneMapping(
      gl,
      {
        mode: toneMapMode,
        exposure: toneMapExposure,
        white: toneMapWhite,
        agxContrast: toneMapAgxContrast,
      },
      scene
    );
  }, [gl, scene, toneMapMode, toneMapExposure, toneMapWhite, toneMapAgxContrast, suppressToneMapping]);

  const { fog, volumetricFog } = settings;
  const sceneFog = useMemo(() => sceneFogFor({ fog, volumetricFog }), [fog, volumetricFog]);
  useEffect(() => {
    const previousFog = scene.fog;
    if (sceneFog) scene.fog = sceneFog;
    return () => {
      scene.fog = previousFog;
    };
  }, [scene, sceneFog]);

  return null;
}

function showsBackgroundColor(mode: BackgroundMode): boolean {
  return mode === BackgroundMode.BG_COLOR || mode === BackgroundMode.BG_CLEAR_COLOR;
}
