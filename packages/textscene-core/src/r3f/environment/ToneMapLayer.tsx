/**
 * The root world's tone mapping on its canvas: one route per frame. The curve installs for every
 * pass that renders the root world, and the compositor's tone pass draws the canvas when glow,
 * blending, the adjustments, the auto exposure or MSAA need it, or three draws the curve per material
 * when nothing does.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { installToneMapping, type ToneMapRoute } from '../../resources/environment/toneMapping';
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
  useToneMapping(toneMapping, pass ? 'compositor' : 'material');
  if (!pass) return null;
  return (
    <Compositor
      pass={pass}
      adjustments={settings?.adjustments ?? null}
      toneMapping={toneMapping}
      resources={resources}
    />
  );
}

function useToneMapping(toneMapping: EnvironmentSettings['toneMapping'], route: ToneMapRoute): void {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const { mode, exposure, white, agxContrast } = toneMapping;
  useEffect(
    () => installToneMapping(gl, { mode, exposure, white, agxContrast }, route, scene),
    [gl, scene, mode, exposure, white, agxContrast, route]
  );
}
