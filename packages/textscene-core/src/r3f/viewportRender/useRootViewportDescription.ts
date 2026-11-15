import type { ProjectSettings } from '../../parser/projectSettingsParser.js';
import { perObject } from '../../utils/perObject.js';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { rootViewportDescription, type ViewportDescription } from './viewportDescription.js';

// One description for each settings object, so every reader shares its identity and its reads.
const rootDescriptionOf = perObject((settings: ProjectSettings) => rootViewportDescription(settings));
const NO_PROJECT_DESCRIPTION = rootViewportDescription(null);

export function useRootViewportDescription(): ViewportDescription {
  const { settings } = useProjectSettings();
  return settings ? rootDescriptionOf(settings) : NO_PROJECT_DESCRIPTION;
}
