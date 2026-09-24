/**
 * The active scene's **Project settings**, from `res://project.godot`. A scene
 * without one renders at Godot's defaults, so the file loads through
 * `FileEventBus.tryLoad` (ADR-0028), never `useResource`, which reports a miss.
 * The default (no settings, theme scale 1.0) needs no provider.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  parseProjectSettings,
  projectThemeScale,
  projectViewportSize,
  DEFAULT_THEME_SCALE,
  DEFAULT_VIEWPORT_WIDTH,
  DEFAULT_VIEWPORT_HEIGHT,
  type ProjectSettings,
  type ProjectViewportSize,
} from '../../parser/projectSettingsParser.js';
import { useResourceLoader } from '../../resources/useResource.js';
import * as logger from '../../logger.js';

/** Where Godot keeps a project's settings, relative to its `res://` root. */
export const PROJECT_SETTINGS_PATH = 'res://project.godot';

export interface ProjectSettingsValue {
  /** Raw settings by full name, such as `gui/theme/default_theme_scale`, or null. */
  settings: ProjectSettings | null;
  /** `gui/theme/default_theme_scale`, clamped, or 1.0 without a project. */
  themeScale: number;
  /** `display/window/size/viewport_*`, or Godot's 1152x648 without a project. */
  viewportSize: ProjectViewportSize;
}

const DEFAULT_VALUE: ProjectSettingsValue = {
  settings: null,
  themeScale: DEFAULT_THEME_SCALE,
  viewportSize: {
    width: DEFAULT_VIEWPORT_WIDTH,
    height: DEFAULT_VIEWPORT_HEIGHT,
  },
};

const ProjectSettingsContext = createContext<ProjectSettingsValue>(DEFAULT_VALUE);
ProjectSettingsContext.displayName = 'ProjectSettingsContext';

export interface ProjectSettingsProviderProps {
  children: ReactNode;
  /**
   * Changes on a scene swap. `res://project.godot` is one path in every corpus,
   * mapped through the active **Corpus root**, so a new key re-reads it. A
   * corpus switch clears the byte layer first (`loader.clearCaches()`).
   */
  sceneKey?: string;
}

export function ProjectSettingsProvider({ children, sceneKey }: ProjectSettingsProviderProps) {
  const loader = useResourceLoader();
  const [settings, setSettings] = useState<ProjectSettings | null>(null);

  useEffect(() => {
    const bus = loader?.fileEventBus;
    if (!bus) {
      setSettings(null);
      return undefined;
    }

    let cancelled = false;
    // Cleared before the fetch, or one frame renders the scene at the previous
    // project's theme scale.
    setSettings(null);

    void (async () => {
      const content = await bus.tryLoad(PROJECT_SETTINGS_PATH, 'ProjectSettings');
      if (cancelled) return;
      if (typeof content !== 'string') return;
      const parsed = parseProjectSettings(content);
      if (parsed) {
        logger.info(
          `[ProjectSettings] Loaded ${Object.keys(parsed).length} settings from ${PROJECT_SETTINGS_PATH}`
        );
      }
      setSettings(parsed);
    })();

    return () => {
      cancelled = true;
    };
  }, [loader, sceneKey]);

  const value = useMemo<ProjectSettingsValue>(
    () => ({
      settings,
      themeScale: projectThemeScale(settings),
      viewportSize: projectViewportSize(settings),
    }),
    [settings]
  );

  return (
    <ProjectSettingsContext.Provider value={value}>{children}</ProjectSettingsContext.Provider>
  );
}

/** The active scene's project settings. Safe without a provider. */
export function useProjectSettings(): ProjectSettingsValue {
  return useContext(ProjectSettingsContext);
}
