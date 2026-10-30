/**
 * Applies one Godot `Environment` to its world, authored or the editor preview's (ADR-0025):
 * background, sky, flat ambient, depth fog and volumetric fog. Each part writes the scene only while
 * its Environment is on it (`sceneEnvironment.tsx`) and restores what it found, because the renderer
 * and scene outlive an environment. The tonemap, the glow and the colour adjustments run in each
 * viewport's tonemap pass (`toneMapPass.ts`).
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BackgroundMode } from '../../godot/scene/environment';
import { FOG_SUN_SCATTER_MIN } from '../../godot/rendering/environment/depthFog';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { Sky } from '../../resources/sky/types';
import { godotColorToLinear } from '../godotColor';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { useDraws3D } from './draws3D';
import { useViewportMode } from '../contexts/ViewportModeContext';
import { SkyLayer } from '../sky/SkyLayer';
import type { SceneResources } from '../SceneResourcesContext';
import { FogLayer } from '../fog/FogLayer';
import { clearColorTexture, foggedClearColorTexture } from './colorBackground';
import { registerExposureStage, type ExposureStage } from '../exposure/sceneExposure';
import { useExposureFactor } from './worldExposure';
import { scaledRgb } from '../../utils/colorParser';
import {
  DrawnEnvironment,
  registerEnvironmentPart,
  ShownEnvironment,
  showBackground,
  useEnvironmentKey,
} from './sceneEnvironment';

export interface EnvironmentLayerProps {
  settings: EnvironmentSettings;
  /** The resolved sky, or null when there is none to render. */
  sky: Sky | null;
  /** The pools the sky material's references, such as a panorama, resolve in. */
  skyResources: SceneResources;
}

/** The Environment its world's scene shows. */
export function EnvironmentLayer(props: EnvironmentLayerProps) {
  return (
    <ShownEnvironment environment={props.settings}>
      <EnvironmentParts {...props} />
    </ShownEnvironment>
  );
}

/**
 * An Environment a viewport pass draws its world with, which the world's scene does not show. The
 * pass tonemaps it itself.
 */
export function DrawnEnvironmentLayer(props: EnvironmentLayerProps) {
  return (
    <DrawnEnvironment environment={props.settings}>
      <EnvironmentParts {...props} />
    </DrawnEnvironment>
  );
}

function EnvironmentParts({ settings, sky, skyResources }: EnvironmentLayerProps) {
  // Godot draws the sky as the background under BG_SKY and takes ambient from
  // it whenever the source resolves to a cubemap. The two are independent: a
  // sky can light the scene without being shown (AMBIENT_SOURCE_SKY over a
  // colour background) and can be shown without lighting it (ambient DISABLED).
  const showsSky = settings.background.mode === BackgroundMode.BG_SKY;
  const skyAmbient = settings.skyAmbient;
  const draws3D = useDraws3D();
  const { showFog } = useViewportMode();
  // One value decides the fog programs, the fogged colour background and the fog passes.
  const hasFog = draws3D && showFog && (!!settings.fog || !!settings.volumetricFog);
  useColorBackground(settings, !!sky, hasFog);
  useFlatAmbient(settings.ambient);

  return (
    <>
      {hasFog && <FogLayer depth={settings.fog} volumetric={settings.volumetricFog} />}
      {sky && (showsSky || skyAmbient) && (
        <SkyLayer
          sky={sky}
          asBackground={showsSky}
          energyMultiplier={settings.background.energyMultiplier}
          rotation={settings.skyRotation}
          contribution={skyAmbient ? skyAmbient.contribution : 1}
          resources={skyResources}
          fogScattersSun={(settings.fog?.sunScatter ?? 0) > FOG_SUN_SCATTER_MIN}
        />
      )}
    </>
  );
}

/**
 * Lights the scene with the flat ambient, when it has energy. `* LIGHT_INTENSITY_SCALE`: Godot adds
 * `ambient_light * albedo` with no 1/PI, while three multiplies the colour by `albedo/PI`. The sky
 * ambient takes no factor, because `godotIBLIrradiance` already returns `PI * envColor * intensity`.
 */
function useFlatAmbient(ambient: EnvironmentSettings['ambient']): void {
  const scene = useThree((state) => state.scene);
  const environment = useEnvironmentKey();
  const color = ambient?.color;
  const energy = ambient?.energy ?? 0;
  useEffect(() => {
    if (!color || energy <= 0) return undefined;
    const light = new THREE.AmbientLight(godotColorToLinear(color), energy * LIGHT_INTENSITY_SCALE);
    // Shown, not added: an add per pass would tell every tracker of the scene that it changed.
    light.visible = false;
    scene.add(light);
    const stopRegistering = registerEnvironmentPart(scene, environment, () => {
      light.visible = true;
      return () => {
        light.visible = false;
      };
    });
    return () => {
      stopRegistering();
      scene.remove(light);
    };
  }, [scene, environment, color, energy]);
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
  const showsColor = showsBackgroundColor(mode);
  const exposure = useExposureFactor();
  const environment = useEnvironmentKey();

  // Each branch restores only what it wrote: a sky's background and intensity belong to `<SkyLayer>`.
  // A colour draws as a texture, not a clear, since three's clear skips the fog (`colorBackground.ts`).
  useEffect(() => {
    if (showsColor) {
      const textureAt = (factor: number) => {
        const exposedColor = scaledRgb(backgroundColor, factor);
        return hasFog ? foggedClearColorTexture(exposedColor) : clearColorTexture(exposedColor);
      };
      const intensityAt = (factor: number) => (hasFog ? backgroundEnergy * factor : 1);
      const heldTexture = textureAt(exposure);
      // Kept for the next draw: a probe that captures each frame draws at the same exposure each time.
      let stagedTexture: { factor: number; texture: THREE.Texture } | null = null;
      const stage: ExposureStage = (target) => {
        const factor = target ?? 1;
        if (stagedTexture?.factor !== factor) {
          stagedTexture?.texture.dispose();
          stagedTexture = { factor, texture: textureAt(factor) };
        }
        return showBackground(scene, stagedTexture.texture, intensityAt(factor));
      };
      const stopRegistering = registerEnvironmentPart(scene, environment, () => {
        const restoreBackground = showBackground(scene, heldTexture, intensityAt(exposure));
        const stopStaging = registerExposureStage(scene, stage);
        return () => {
          stopStaging();
          restoreBackground();
        };
      });
      return () => {
        stopRegistering();
        heldTexture.dispose();
        stagedTexture?.texture.dispose();
      };
    }
    if (mode === BackgroundMode.BG_SKY && !hasSky) {
      // A sky we cannot resolve, such as a ShaderMaterial sky. A mid-blue solid reads as
      // "sky here" rather than as a black void.
      const placeholder = clearColorTexture(UNRESOLVED_SKY_COLOR);
      const stopRegistering = registerEnvironmentPart(scene, environment, () =>
        showBackground(scene, placeholder, 1)
      );
      return () => {
        stopRegistering();
        placeholder.dispose();
      };
    }
    return undefined;
  }, [scene, environment, showsColor, mode, backgroundColor, backgroundEnergy, exposure, hasSky, hasFog]);
}

const UNRESOLVED_SKY_COLOR = { r: 0.5, g: 0.6, b: 0.75 };

function showsBackgroundColor(mode: number): boolean {
  return mode === BackgroundMode.BG_COLOR || mode === BackgroundMode.BG_CLEAR_COLOR;
}
