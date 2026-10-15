/**
 * `<NoEnvironmentCompositor>`: the compositor of a 3D root that has no Environment. Godot still
 * multisamples and blends that root in its HDR buffer, then tonemaps it with the pass defaults:
 * LINEAR, exposure 1 and white 1 (`tone_mapper.h:177-180`, kept with no Environment by
 * `renderer_scene_render_rd.cpp:724-731`).
 */

import { DEFAULT_AGX_CONTRAST, type EnvironmentSettings } from '../../resources/environment/types';
import { GodotToneMapper } from '../../resources/environment/godotToneMapping';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { ToneMapLayer } from './ToneMapLayer';
import { useCompositorPass } from './useCompositorPass';

const NO_ENVIRONMENT_TONE_MAPPING: EnvironmentSettings['toneMapping'] = {
  mode: GodotToneMapper.LINEAR,
  exposure: 1,
  white: 1,
  agxContrast: DEFAULT_AGX_CONTRAST,
};

export function NoEnvironmentCompositor() {
  const composited = useCompositorPass(null);
  if (!composited) return null;
  return (
    <ToneMapLayer
      glow={null}
      samples={composited.samples}
      adjustments={null}
      toneMapping={NO_ENVIRONMENT_TONE_MAPPING}
      resources={NO_RESOURCES}
    />
  );
}
