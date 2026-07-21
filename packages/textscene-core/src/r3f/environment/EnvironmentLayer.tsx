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

import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BackgroundMode } from '../../resources/environment/types';
import type { EnvironmentSettings } from '../../resources/environment/renderer';
import { applyToneMapping } from '../../resources/environment/toneMapping';
import type { SkyProperties } from '../../resources/sky/types';
import { godotColorToLinear } from '../godotColor';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { SkyLayer } from '../sky/SkyLayer';

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

  return (
    <>
      <EnvironmentApplier settings={settings} hasSky={!!sky} />
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

interface EnvironmentApplierProps {
  settings: EnvironmentSettings;
  /** When a real sky renders, it owns the background and this must not fight it. */
  hasSky: boolean;
}

function EnvironmentApplier({ settings, hasSky }: EnvironmentApplierProps) {
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
  useEffect(
    () =>
      applyToneMapping(
        gl,
        { mode: toneMapMode, exposure: toneMapExposure, white: toneMapWhite },
        scene
      ),
    [gl, scene, toneMapMode, toneMapExposure, toneMapWhite]
  );

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
