/** The root viewport's description, the same object while the project settings object holds. */

import { useMemo } from 'react';
import { useProjectSettings } from '../contexts/ProjectSettingsContext.js';
import { rootViewportDescription, type ViewportDescription } from './viewportDescription.js';

export function useRootViewportDescription(): ViewportDescription {
  const { settings } = useProjectSettings();
  return useMemo(() => rootViewportDescription(settings), [settings]);
}
