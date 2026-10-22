/** The project's `anisotropic_filtering_level`, which a viewport takes at construction (`viewport.cpp:5384`). */

import { projectAnisotropicFilteringLevel } from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';

export function useProjectAnisotropicFilteringLevel(): number {
  return projectAnisotropicFilteringLevel(useProjectSettings().settings);
}
