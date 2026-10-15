/**
 * Applies one Godot `Environment` to its world, authored or the editor preview's (ADR-0025):
 * background, sky, flat ambient, tonemapping, glow, colour adjustments, depth fog and volumetric fog.
 * Each restores what it found on unmount, because the renderer and scene outlive an environment.
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { BackgroundMode, type EnvironmentSettings } from '../../resources/environment/types';
import { applyToneMapping, installToneCurve } from '../../resources/environment/toneMapping';
import type { Sky } from '../../resources/sky/types';
import { godotColorToLinear } from '../godotColor';
import { LIGHT_INTENSITY_SCALE } from '../lightConstants';
import { useCompositorPass, useDraws3D } from './useCompositorPass';
import { useWorldKind } from './WorldKindContext';
import { SkyLayer } from '../sky/SkyLayer';
import type { SceneResources } from '../SceneResourcesContext';
import { ToneMapLayer } from './ToneMapLayer';
import { FogLayer } from '../fog/FogLayer';
import { clearColorCube } from './colorBackground';

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
  const pass = useCompositorPass(settings);
  // One value decides the pass and the suppression, so they cannot disagree. Only the root world
  // mounts the compositor: a portal store shares the root's internal state, so a sub-viewport
  // world's compositor would draw the portal scene onto the canvas, not into the target.
  const compositor = useWorldKind() === 'root' ? pass : null;
  // One value decides the fog programs, the fogged colour background and the fog passes.
  const hasFog = draws3D && (!!settings.fog || !!settings.volumetricFog);

  return (
    <>
      <EnvironmentApplier
        settings={settings}
        hasSky={!!sky}
        hasFog={hasFog}
        suppressToneMapping={!!compositor}
      />
      {compositor && (
        <ToneMapLayer
          glow={compositor.glow}
          samples={compositor.samples}
          adjustments={settings.adjustments}
          toneMapping={settings.toneMapping}
          resources={resources}
        />
      )}
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

interface EnvironmentApplierProps {
  settings: EnvironmentSettings;
  /** When a real sky renders, it owns the background and this must not fight it. */
  hasSky: boolean;
  /** Whether the depth fog or the volumetric fog draws, which fog every program and the background. */
  hasFog: boolean;
  /**
   * The composer forces `NoToneMapping` while mounted and `GodotToneMapEffect` applies the curve,
   * so the renderer's mapping is not set here. The curve still installs for a shared-world
   * `SubViewport` pass, which renders the root world without the composer.
   */
  suppressToneMapping: boolean;
}

function EnvironmentApplier({ settings, hasSky, hasFog, suppressToneMapping }: EnvironmentApplierProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);

  const { mode, color: backgroundColor, energyMultiplier: backgroundEnergy } = settings.background;
  const showsColor = showsBackgroundColor(mode);

  // Each branch restores only what it wrote: a sky's background and intensity belong to `<SkyLayer>`.
  useEffect(() => {
    if (showsColor) {
      if (!hasFog)
        return showBackground(scene, godotColorToLinear(backgroundColor), scene.backgroundIntensity);
      const cube = clearColorCube(backgroundColor);
      const restore = showBackground(scene, cube, backgroundEnergy);
      return () => {
        restore();
        cube.dispose();
      };
    }
    if (mode === BackgroundMode.BG_SKY && !hasSky) {
      // A sky we cannot resolve, such as a ShaderMaterial sky. A mid-blue solid reads as
      // "sky here" rather than as a black void.
      return showBackground(
        scene,
        godotColorToLinear({ r: 0.5, g: 0.6, b: 0.75 }),
        scene.backgroundIntensity
      );
    }
    return undefined;
  }, [scene, showsColor, mode, backgroundColor, backgroundEnergy, hasSky, hasFog]);

  const {
    mode: toneMapMode,
    exposure: toneMapExposure,
    white: toneMapWhite,
    agxContrast: toneMapAgxContrast,
  } = settings.toneMapping;
  // `THREE.ShaderChunk` is module-global, so a sub-viewport's world installs no curve over the root's.
  const tonesRenderer = useWorldKind() === 'root';
  useEffect(() => {
    if (!tonesRenderer) return undefined;
    const toneMapping = {
      mode: toneMapMode,
      exposure: toneMapExposure,
      white: toneMapWhite,
      agxContrast: toneMapAgxContrast,
    };
    return suppressToneMapping
      ? installToneCurve(gl, toneMapping, scene)
      : applyToneMapping(gl, toneMapping, scene);
  }, [
    gl,
    scene,
    tonesRenderer,
    toneMapMode,
    toneMapExposure,
    toneMapWhite,
    toneMapAgxContrast,
    suppressToneMapping,
  ]);

  return null;
}

/** Draws `background` at `intensity` behind `scene`, and answers the restore of what it found. */
function showBackground(
  scene: THREE.Scene,
  background: THREE.Color | THREE.CubeTexture,
  intensity: number
): () => void {
  const previousBackground = scene.background;
  const previousIntensity = scene.backgroundIntensity;
  scene.background = background;
  scene.backgroundIntensity = intensity;
  return () => {
    scene.background = previousBackground;
    scene.backgroundIntensity = previousIntensity;
  };
}

function showsBackgroundColor(mode: BackgroundMode): boolean {
  return mode === BackgroundMode.BG_COLOR || mode === BackgroundMode.BG_CLEAR_COLOR;
}
