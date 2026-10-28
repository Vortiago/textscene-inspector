/** The project's layout direction environment, for the Control walks and the sub-viewports under them. */
import { useMemo } from 'react';
import type { LayoutDirectionEnv } from '../../godot/scene/control.js';
import { projectLayoutDirectionEnv } from '../../parser/projectSettingsParser.js';
import { useProjectSettings } from './ProjectSettingsContext.js';

/**
 * `internationalization/*`, reduced to the booleans `is_layout_rtl` branches on.
 *
 * @canonical The project's layout direction environment
 */
export function useLayoutDirectionEnv(): LayoutDirectionEnv {
  const { settings } = useProjectSettings();
  return useMemo(() => projectLayoutDirectionEnv(settings), [settings]);
}
