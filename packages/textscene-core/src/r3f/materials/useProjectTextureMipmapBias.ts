/** The project's `texture_mipmap_bias`, which a viewport takes at construction (`viewport.cpp:5383`). */

import { projectTextureMipmapBias } from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';

export function useProjectTextureMipmapBias(): number {
  return projectTextureMipmapBias(useProjectSettings().settings);
}
