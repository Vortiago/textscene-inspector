/** Project settings for tests, each as the `project.godot` text and as the settings it parses to. */
import { parseProjectSettings, type ProjectSettings } from './projectSettingsParser';

/** A `project.godot` whose root window embeds no windows, so each window below it is native. */
export const PROJECT_ROOT_EMBEDS_NO_WINDOWS = '[display]\n\nwindow/subwindows/embed_subwindows=false\n';

/** The settings of {@link PROJECT_ROOT_EMBEDS_NO_WINDOWS}. */
export const ROOT_EMBEDS_NO_WINDOWS: ProjectSettings = parseProjectSettings(PROJECT_ROOT_EMBEDS_NO_WINDOWS)!;
