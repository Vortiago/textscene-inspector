/**
 * The texels in one 2D light's shadow map: the project's `rendering/2d/shadow_atlas/size`, which
 * every light of the canvas shares.
 */

import { projectShadowAtlasSize } from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';

export function useShadowAtlasSize(): number {
  return projectShadowAtlasSize(useProjectSettings().settings);
}
