/**
 * `<NoEnvironmentLayer>`: a 3D root that has no Environment. Godot clears it to the project's clear
 * colour, multisamples and blends it in its HDR buffer, then tonemaps it with the pass defaults:
 * LINEAR, exposure 1 and white 1 (`tone_mapper.h:177-180`, kept with no Environment by
 * `renderer_scene_render_rd.cpp:724-731`).
 */

import type { EnvironmentSettings } from '../../resources/environment/types';
import { TONEMAP_AGX_CONTRAST_DEFAULT, ToneMapper } from '../../godot/rendering/environment/toneMapping';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { ProjectClearColor } from '../ProjectClearColor';
import { ToneMapLayer } from './ToneMapLayer';
import { useCompositorPass } from './useCompositorPass';

/**
 * The tonemap pass's own defaults (`tone_mapper.h:177-180`), not an Environment's. They equal the
 * Environment defaults (`environment.h:115-117`) only by chance, so neither is read from the other.
 */
const NO_ENVIRONMENT_TONE_MAPPING: EnvironmentSettings['toneMapping'] = {
  mode: ToneMapper.LINEAR,
  exposure: 1,
  white: 1,
  agxContrast: TONEMAP_AGX_CONTRAST_DEFAULT,
};

export function NoEnvironmentLayer() {
  const composited = useCompositorPass(null);
  return (
    <>
      <ProjectClearColor />
      {composited && (
        <ToneMapLayer
          glow={null}
          samples={composited.samples}
          adjustments={null}
          toneMapping={NO_ENVIRONMENT_TONE_MAPPING}
          resources={NO_RESOURCES}
        />
      )}
    </>
  );
}
