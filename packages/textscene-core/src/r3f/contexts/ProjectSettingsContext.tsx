/**
 * The active scene's **Project settings** — `project.godot` at its `res://`
 * root, parsed and exposed to the render tree.
 *
 * Found by CONVENTION at `res://project.godot`, so absence is an ordinary
 * outcome, not a fault: most fixtures are loose scenes with no project around
 * them, and a scene without one renders at Godot's defaults — which is exactly
 * what Godot itself does (`ThemeDB::initialize_theme_noproject()` builds the
 * default theme at scale 1.0). That is why the file is fetched through
 * `FileEventBus.tryLoad`, the same seam ADR-0028 uses for an **Import
 * sidecar**, and never through `useResource`: the latter reports every
 * unavailable path to the Missing Resources panel, and 78 of the corpus's
 * projects having one would still leave every unit fixture reporting a false
 * miss.
 *
 * The context has a SAFE DEFAULT (no settings, theme scale 1.0), so every
 * consumer renders correctly with no provider mounted — which is what keeps the
 * scale-1 path, and the tests that exercise it, byte-identical to before.
 *
 * Only ENUMERATED settings are exposed. `themeScale` is the one this previewer
 * honours today; the raw `settings` record is here so the next one is a reader,
 * not a re-plumbing.
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
  DEFAULT_THEME_SCALE,
  type ProjectSettings,
} from '../../parser/projectSettingsParser.js';
import { useResourceLoader } from '../../resources/useResource.js';
import * as logger from '../../logger.js';

/** Where Godot keeps a project's settings, relative to its `res://` root. */
export const PROJECT_SETTINGS_PATH = 'res://project.godot';

export interface ProjectSettingsValue {
  /** Raw settings by full name (`gui/theme/default_theme_scale`), or null. */
  settings: ProjectSettings | null;
  /** `gui/theme/default_theme_scale`, clamped; 1.0 without a project. */
  themeScale: number;
}

const DEFAULT_VALUE: ProjectSettingsValue = {
  settings: null,
  themeScale: DEFAULT_THEME_SCALE,
};

const ProjectSettingsContext = createContext<ProjectSettingsValue>(DEFAULT_VALUE);
ProjectSettingsContext.displayName = 'ProjectSettingsContext';

export interface ProjectSettingsProviderProps {
  children: ReactNode;
  /**
   * Changes when the previewer swaps scenes. The settings are re-read on a new
   * key because `res://project.godot` is the SAME path in every corpus — the
   * web previewer maps it through the active **Corpus root**, so the bytes
   * behind it differ per project. A corpus switch already drops the byte layer
   * (`useCorpusRoot`'s `applyCorpusRoot` → `loader.clearCaches()` →
   * `runClearCachesSequence`'s `clearFileBus`), so the re-read here hits a
   * cleared cache and fetches the incoming project's file rather than serving
   * the outgoing one's.
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
    // Cleared before the fetch, never after it resolves: leaving the previous
    // project's settings up while the new one loads would render one scene at
    // another's theme scale for a frame.
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
    () => ({ settings, themeScale: projectThemeScale(settings) }),
    [settings]
  );

  return (
    <ProjectSettingsContext.Provider value={value}>{children}</ProjectSettingsContext.Provider>
  );
}

/** Read the active scene's project settings. Safe without a provider. */
export function useProjectSettings(): ProjectSettingsValue {
  return useContext(ProjectSettingsContext);
}
