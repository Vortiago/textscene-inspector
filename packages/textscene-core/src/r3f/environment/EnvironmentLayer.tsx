/**
 * Applies one Godot `Environment` to its world, authored or the editor preview's (ADR-0025):
 * background, sky, flat ambient, tonemapping, glow, colour adjustments, depth fog and volumetric fog.
 * Each restores what it found on unmount, because the renderer and scene outlive an environment.
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BackgroundMode } from '../../godot/scene/environment';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { Sky } from '../../resources/sky/types';
import { godotColorToLinear } from '../godotColor';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { useDraws3D } from './useCompositorPass';
import { useWorldKind } from './WorldKindContext';
import { useViewportMode } from '../contexts/ViewportModeContext';
import { SkyLayer } from '../sky/SkyLayer';
import type { SceneResources } from '../SceneResourcesContext';
import { ToneMapLayer } from './ToneMapLayer';
import { FogLayer } from '../fog/FogLayer';
import { clearColorTexture, foggedClearColorTexture } from './colorBackground';
import { registerExposureStage } from '../exposure/sceneExposure';
import { useExposureFactor } from './worldExposure';
import { scaledRgb } from '../../utils/colorParser';
import { usePublishWorldToneMap } from './worldToneMap';

export interface EnvironmentLayerProps {
  settings: EnvironmentSettings;
  /** The resolved sky, or null when there is none to render. */
  sky: Sky | null;
  /** The pools the Environment's own references, such as `glow_map`, resolve in. */
  resources: SceneResources;
  /** The pools the sky material's references, such as a panorama, resolve in. */
  skyResources: SceneResources;
}

export function EnvironmentLayer({ settings, sky, resources, skyResources }: EnvironmentLayerProps) {
  // Godot draws the sky as the background under BG_SKY and takes ambient from
  // it whenever the source resolves to a cubemap. The two are independent: a
  // sky can light the scene without being shown (AMBIENT_SOURCE_SKY over a
  // colour background) and can be shown without lighting it (ambient DISABLED).
  const showsSky = settings.background.mode === BackgroundMode.BG_SKY;
  const skyAmbient = settings.skyAmbient;
  const flatAmbient = settings.ambient;
  const draws3D = useDraws3D();
  usePublishWorldToneMap(settings, resources);
  // Only the root world tonemaps the canvas. `THREE.ShaderChunk` is module-global, so a sub-viewport
  // world's curve would replace the root's, and a portal store shares the root's internal state, so
  // its compositor would draw the portal scene onto the canvas, not into the target.
  const tonesCanvas = useWorldKind() === 'root';
  const { showFog } = useViewportMode();
  // One value decides the fog programs, the fogged colour background and the fog passes.
  const hasFog = draws3D && showFog && (!!settings.fog || !!settings.volumetricFog);
  useColorBackground(settings, !!sky, hasFog);

  return (
    <>
      {tonesCanvas && <ToneMapLayer settings={settings} resources={resources} />}
      {hasFog && (
        <FogLayer
          depth={settings.fog}
          volumetric={settings.volumetricFog}
          skyEnergy={settings.background.energyMultiplier}
        />
      )}
      {sky && (showsSky || skyAmbient) && (
        <SkyLayer
          sky={sky}
          asBackground={showsSky}
          backgroundIntensity={settings.background.energyMultiplier}
          rotation={settings.skyRotation}
          // Godot reflects the sky at `background_energy_multiplier` whatever the ambient source.
          intensity={skyAmbient ? skyAmbient.energy : 0}
          contribution={skyAmbient ? skyAmbient.contribution : 1}
          resources={skyResources}
        />
      )}
      {flatAmbient && flatAmbient.energy > 0 && (
        // `* LIGHT_INTENSITY_SCALE`: Godot adds `ambient_light * albedo` with no 1/PI, while three
        // multiplies the colour by `albedo/PI`. The sky ambient takes no factor, because
        // `godotIBLIrradiance` already returns `PI * envColor * intensity`.
        <ambientLight
          color={godotColorToLinear(flatAmbient.color)}
          intensity={flatAmbient.energy * LIGHT_INTENSITY_SCALE}
        />
      )}
    </>
  );
}

/**
 * Draws a colour background, or a placeholder for a sky that does not resolve. `hasSky` is true when
 * a sky resolves, so `<SkyLayer>` owns the background. `hasFog` is true when a fog draws, which fogs it.
 * The world's exposure scales the colour in sRGB, before the conversion to linear, and under fog the
 * brightness that draws it again (`render_forward_clustered.cpp:1988-2014`, `:2045`).
 */
function useColorBackground(settings: EnvironmentSettings, hasSky: boolean, hasFog: boolean): void {
  const scene = useThree((state) => state.scene);
  const { mode, color: backgroundColor, energyMultiplier: backgroundEnergy } = settings.background;
  const { mode: curveMode, white: curveWhite, agxContrast: curveAgxContrast } = settings.toneMapping;
  const showsColor = showsBackgroundColor(mode);
  const exposure = useExposureFactor();

  // Each branch restores only what it wrote: a sky's background and intensity belong to `<SkyLayer>`.
  // A colour draws as a texture, not a clear, since three's clear skips the curve Godot applies to it.
  // A new texture per curve: three recompiles its background material only for a new texture or a new
  // `toneMapping` enum, and every curve draws under the one `CustomToneMapping`.
  useEffect(() => {
    if (showsColor) {
      const textureAt = (factor: number) => {
        const exposedColor = scaledRgb(backgroundColor, factor);
        return hasFog ? foggedClearColorTexture(exposedColor) : clearColorTexture(exposedColor);
      };
      const intensityAt = (factor: number) => (hasFog ? backgroundEnergy * factor : 1);
      const heldTexture = textureAt(exposure);
      const restoreBackground = showBackground(scene, heldTexture, intensityAt(exposure));
      // Kept for the next draw: a probe that captures each frame draws at the same exposure each time.
      let stagedTexture: { factor: number; texture: THREE.Texture } | null = null;
      const stopStaging = registerExposureStage(scene, (target) => {
        const factor = target ?? 1;
        if (stagedTexture?.factor !== factor) {
          stagedTexture?.texture.dispose();
          stagedTexture = { factor, texture: textureAt(factor) };
        }
        return showBackground(scene, stagedTexture.texture, intensityAt(factor));
      });
      return () => {
        stopStaging();
        restoreBackground();
        heldTexture.dispose();
        stagedTexture?.texture.dispose();
      };
    }
    if (mode === BackgroundMode.BG_SKY && !hasSky) {
      // A sky we cannot resolve, such as a ShaderMaterial sky. A mid-blue solid reads as
      // "sky here" rather than as a black void.
      const placeholder = clearColorTexture(UNRESOLVED_SKY_COLOR);
      const restoreBackground = showBackground(scene, placeholder, 1);
      return () => {
        restoreBackground();
        placeholder.dispose();
      };
    }
    return undefined;
  }, [
    scene,
    showsColor,
    mode,
    backgroundColor,
    backgroundEnergy,
    exposure,
    hasSky,
    hasFog,
    curveMode,
    curveWhite,
    curveAgxContrast,
  ]);
}

const UNRESOLVED_SKY_COLOR = { r: 0.5, g: 0.6, b: 0.75 };

/** Draws `texture` at `intensity` behind `scene`, and answers the restore of what it found. */
function showBackground(scene: THREE.Scene, texture: THREE.Texture, intensity: number): () => void {
  const previousBackground = scene.background;
  const previousIntensity = scene.backgroundIntensity;
  scene.background = texture;
  scene.backgroundIntensity = intensity;
  return () => {
    scene.background = previousBackground;
    scene.backgroundIntensity = previousIntensity;
  };
}

function showsBackgroundColor(mode: number): boolean {
  return mode === BackgroundMode.BG_COLOR || mode === BackgroundMode.BG_CLEAR_COLOR;
}
