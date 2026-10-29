/**
 * The root world's tone mapping on its canvas. The compositor's tone pass draws every 3D frame
 * (ADR-0061). A canvas with no real 3D GL context has three draw the curve in each material.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { installToneMapping } from '../../resources/environment/toneMapping';
import { NO_ENVIRONMENT_TONE_MAPPING } from '../../godot/rendering/environment/toneMapping';
import type { SceneResources } from '../SceneResourcesContext';
import { Compositor } from './Compositor';
import { useCompositorPass } from './useCompositorPass';

interface ToneMapLayerProps {
  /** Null for a root with no Environment, whose tonemap pass keeps its own defaults. */
  settings: EnvironmentSettings | null;
  /** The pools the Environment's own references, such as `glow_map`, resolve in. */
  resources: SceneResources;
}

export function ToneMapLayer({ settings, resources }: ToneMapLayerProps) {
  const pass = useCompositorPass(settings);
  const toneMapping = settings?.toneMapping ?? NO_ENVIRONMENT_TONE_MAPPING;
  if (!pass) return <MaterialToneMapping toneMapping={toneMapping} />;
  return (
    <Compositor
      pass={pass}
      adjustments={settings?.adjustments ?? null}
      toneMapping={toneMapping}
      resources={resources}
    />
  );
}

/** Draws the curve in every material of the root canvas. */
function MaterialToneMapping({ toneMapping }: { toneMapping: EnvironmentSettings['toneMapping'] }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const { mode, exposure, white, agxContrast } = toneMapping;
  useEffect(
    () => installToneMapping(gl, { mode, exposure, white, agxContrast }, scene),
    [gl, scene, mode, exposure, white, agxContrast]
  );
  return null;
}
