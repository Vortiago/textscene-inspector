/**
 * Applies one Godot `Environment` to its world, authored or the editor preview's (ADR-0025):
 * background, sky, flat ambient, depth fog, volumetric fog and screen-space reflection. Each part writes the scene only while
 * its Environment is on it (`sceneEnvironment.tsx`) and restores what it found, because the renderer
 * and scene outlive an environment. The tonemap, the glow and the colour adjustments run in each
 * viewport's tonemap pass (`toneMapPass.ts`).
 */

import { useEffect, type ReactNode } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { flatAmbientIntensity } from '../ambientLight';
import { BackgroundMode } from '../../godot/scene/environment';
import { FOG_SUN_SCATTER_MIN } from '../../godot/rendering/environment/depthFog';
import type { EnvironmentSettings } from '../../resources/environment/types';
import type { AuthoredSky } from '../../resources/sky/types';
import { godotColorToLinear } from '../godotColor';
import { useDraws3D } from './draws3D';
import { useViewShow } from '../viewShow/ViewShowContext';
import { SkyLayer } from '../sky/SkyLayer';
import { NodePathProvider } from '../contexts/NodePathContext';
import { FogLayer } from '../fog/FogLayer';
import { ScreenSpaceEffectsLayer } from '../screenSpaceEffects/ScreenSpaceEffectsLayer';
import { clearColorTexture, foggedClearColorTexture } from './colorBackground';
import { followSceneExposure } from '../exposure/sceneExposure';
import { useExposureFactor } from './worldExposure';
import { scaledRgb } from '../../utils/colorParser';
import { LRUCache } from '../../resources/LRUCache';
import { renderClearsBlack, renderUnderWay } from '../viewportRender/worldRender';
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
  sky: AuthoredSky | null;
  /** The node that holds the Environment, whose details show its sky shader's errors. */
  holderPath?: string | null;
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

function EnvironmentParts({ settings, sky, holderPath }: EnvironmentLayerProps) {
  // Godot draws the sky as the background under BG_SKY and takes ambient from
  // it whenever the source resolves to a cubemap. Surfaces reflect it by their own source. The three
  // are independent: a sky can light the scene without being shown (AMBIENT_SOURCE_SKY over a
  // colour background), be shown without lighting it (ambient DISABLED), or only be reflected.
  const showsSky = settings.background.mode === BackgroundMode.BG_SKY;
  const skyAmbient = settings.skyAmbient;
  const reflectsSky = settings.skyReflection;
  const draws3D = useDraws3D();
  const { fog: showFog } = useViewShow();
  // One value decides the fog programs, the fogged colour background and the fog passes.
  const hasFog = draws3D && showFog && (!!settings.fog || !!settings.volumetricFog);
  useColorBackground(settings, !!sky, hasFog);
  useFlatAmbient(settings.ambient);

  return (
    <>
      {hasFog && <FogLayer depth={settings.fog} volumetric={settings.volumetricFog} />}
      {draws3D && (settings.ssr || settings.ssao) && (
        <ScreenSpaceEffectsLayer ssr={settings.ssr} ssao={settings.ssao} />
      )}
      {sky && (showsSky || skyAmbient || reflectsSky) && (
        <AtHolder path={holderPath}>
          <SkyLayer
            sky={sky}
            asBackground={showsSky}
            energyMultiplier={settings.background.energyMultiplier}
            rotation={settings.skyRotation}
            contribution={skyAmbient ? skyAmbient.contribution : 0}
            isAmbientSource={skyAmbient?.isAmbientSource ?? false}
            reflects={reflectsSky}
            fogScattersSun={(settings.fog?.sunScatter ?? 0) > FOG_SUN_SCATTER_MIN}
          />
        </AtHolder>
      )}
    </>
  );
}

/** The layer mounts above every node, so it takes the holder's path back for what it reports. */
function AtHolder({ path, children }: { path: string | null | undefined; children: ReactNode }) {
  return path ? <NodePathProvider path={path}>{children}</NodePathProvider> : <>{children}</>;
}

/** The sky ambient takes no factor: `godotIBLIrradiance` already returns `PI * envColor * intensity`. */
function useFlatAmbient(ambient: EnvironmentSettings['ambient']): void {
  const scene = useThree((state) => state.scene);
  const environment = useEnvironmentKey();
  const color = ambient?.color;
  const energy = ambient?.energy ?? 0;
  const isClearColor = ambient?.isClearColor === true;
  useEffect(() => {
    if (!color || energy <= 0) return undefined;
    const light = new THREE.AmbientLight(godotColorToLinear(color), flatAmbientIntensity(energy));
    // Shown, not added: an add per pass would tell every tracker of the scene that it changed.
    light.visible = false;
    scene.add(light);
    const stopRegistering = registerEnvironmentPart(scene, environment, () => {
      light.visible = true;
      // Each render lights by its own viewport's clear colour (`render_scene_data_rd.cpp:174-175`).
      const stopFollowing = isClearColor
        ? followSceneExposure(scene, () => {
            light.visible = !renderClearsBlack();
          })
        : null;
      return () => {
        stopFollowing?.();
        light.visible = false;
      };
    });
    return () => {
      stopRegistering();
      scene.remove(light);
    };
  }, [scene, environment, color, energy, isClearColor]);
}

/**
 * Draws a colour background, or a placeholder for a sky that does not resolve. `hasSky` is true when
 * a sky resolves, so `<SkyLayer>` owns the background. `hasFog` is true when a fog draws, which fogs it.
 * The world's exposure scales the colour in sRGB, before the conversion to linear, and under fog the
 * brightness that draws it again (`render_forward_clustered.cpp:1988-2014`, `:2045`).
 */
function useColorBackground(settings: EnvironmentSettings, hasSky: boolean, hasFog: boolean): void {
  const scene = useThree((state) => state.scene);
  const {
    mode,
    color: backgroundColor,
    energyMultiplier: backgroundEnergy,
    ignoresExposure,
  } = settings.background;
  const showsColor = showsBackgroundColor(mode);
  const isClearColor = mode === BackgroundMode.BG_CLEAR_COLOR;
  const sceneExposure = useExposureFactor();
  const exposure = ignoresExposure ? 1 : sceneExposure;
  const environment = useEnvironmentKey();

  // Each branch restores only what it wrote: a sky's background and intensity belong to `<SkyLayer>`.
  // A colour draws as a texture, not a clear, since three's clear skips the fog (`colorBackground.ts`).
  useEffect(() => {
    if (showsColor) {
      // The textures of the factors the renders draw at, the latest last. Viewports of one world
      // draw a few factors in each frame, and a factor no render drew lately is freed.
      const colorTexture = hasFog ? foggedClearColorTexture : clearColorTexture;
      const textures = new LRUCache<THREE.Texture>(KEPT_BACKGROUND_FACTORS, (_factor, texture) =>
        texture.dispose()
      );
      const textureAt = (factor: number) => {
        const key = String(factor);
        const cached = textures.get(key);
        if (cached) return cached;
        const texture = colorTexture(scaledRgb(backgroundColor, factor));
        textures.set(key, texture);
        return texture;
      };
      const intensityAt = (factor: number) => (hasFog ? backgroundEnergy * factor : 1);
      const showAt = (factor: number) => showBackground(scene, textureAt(factor), intensityAt(factor));
      const stopRegistering = registerEnvironmentPart(scene, environment, () => {
        const restoreBackground = showAt(exposure);
        // An interior capture keeps the clear colour its stage drew (`captureStage.ts`).
        const stopFollowing = followSceneExposure(scene, (drawn) => {
          if (renderUnderWay()?.probeCapture?.isInterior) return;
          // A BG_CLEAR_COLOR background is the clear of a viewport that clears to black.
          if (isClearColor && renderClearsBlack()) scene.background = null;
          else showAt(ignoresExposure ? 1 : (drawn ?? 1));
        });
        return () => {
          stopFollowing();
          restoreBackground();
        };
      });
      return () => {
        stopRegistering();
        textures.clear();
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
  }, [
    scene,
    environment,
    showsColor,
    isClearColor,
    mode,
    backgroundColor,
    backgroundEnergy,
    exposure,
    ignoresExposure,
    hasSky,
    hasFog,
  ]);
}

/** The background factors kept drawn: a frame of a few viewports of one world draws at a few. */
const KEPT_BACKGROUND_FACTORS = 4;

const UNRESOLVED_SKY_COLOR = { r: 0.5, g: 0.6, b: 0.75 };

function showsBackgroundColor(mode: number): boolean {
  return mode === BackgroundMode.BG_COLOR || mode === BackgroundMode.BG_CLEAR_COLOR;
}
