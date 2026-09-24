/**
 * Parses Godot's `project.godot`, the configuration at a project's `res://` root, into raw settings keyed
 * by full name. A foreign-format parser outside the resource-slice registry (ADR-0031): no scene names it,
 * so it claims no type name and no bus slot. Not `TscnParserCore`: the file has bare `[section]` headings,
 * plain `key=value` lines and nothing to diagnose, the INI shape its sibling `importParser.ts` parses too.
 */

import { boolSlotValue, isLocaleRightToLeft, type LayoutDirectionEnv } from '../godot/index.js';
import { parseOptionalInt } from './valueParsers.js';

/**
 * A `key=value` line. The key admits `/`, Godot's subsection separator, and `.`: a
 * feature-tagged override like `renderer/rendering_method.mobile` is a real key.
 */
const KEY_VALUE = /^([A-Za-z_][A-Za-z0-9_/.]*)=(.*)$/;
/** A `[section]` heading. Godot's section names are bare identifiers. */
const SECTION = /^\[([A-Za-z_][A-Za-z0-9_]*)\]$/;

/**
 * Raw `project.godot` settings, keyed by full setting name. Typed readers exist only for settings
 * this previewer honours, so the store does not become a settings grab-bag.
 */
export type ProjectSettings = Readonly<Record<string, string>>;

/**
 * A `project.godot`'s settings, or null when the text is not one. Null, not a throw:
 * absence and malformedness are both ordinary, and the caller uses Godot's defaults
 * either way.
 */
export function parseProjectSettings(content: string): ProjectSettings | null {
  const settings: Record<string, string> = {};
  let section: string | null = null;
  let sawSetting = false;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith(';')) continue;

    const heading = SECTION.exec(line);
    if (heading) {
      section = heading[1]!;
      continue;
    }

    // A multi-line quoted value, such as `config/description`, keeps its first line: the
    // continuation has no `=`. No setting this previewer reads is multi-line.
    const pair = KEY_VALUE.exec(line);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    // Godot splits a name across heading and key: `theme/default_theme_scale` under
    // `[gui]` is `gui/theme/default_theme_scale`, as `ProjectSettings.get_setting()`
    // takes it. `config_version` above the first heading keeps its bare name.
    settings[section ? `${section}/${key!}` : key!] = unquote(rawValue!.trim());
    sawSetting = true;
  }

  return sawSetting ? settings : null;
}

/** Godot writes strings quoted; every other value form is left verbatim. */
function unquote(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

/** Godot's default when the project does not set the scale. */
export const DEFAULT_THEME_SCALE = 1.0;

/**
 * `gui/theme/default_theme_scale`, the multiplier on every default-theme metric
 * (`ThemeDB::initialize_theme()` in `scene/theme/theme_db.cpp`, default 1.0). Clamped
 * here to 0.5-8 as `make_default_theme` does (`scene/theme/default_theme.cpp:1369`).
 * Each metric rounds after multiplying ({@link scaledGodotTheme}).
 */
export function projectThemeScale(settings: ProjectSettings | null): number {
  const raw = settings?.['gui/theme/default_theme_scale'];
  // An empty value says nothing, not zero: `Number('')` is 0, which would clamp to 0.5
  // and shrink the UI.
  if (raw === undefined || raw.trim() === '') return DEFAULT_THEME_SCALE;

  const scale = Number(raw);
  // An unparseable or non-finite value falls back, not a collapsed UI.
  if (!Number.isFinite(scale)) return DEFAULT_THEME_SCALE;
  return Math.min(Math.max(scale, 0.5), 8);
}

/**
 * Godot's defaults for `display/window/size/viewport_width` and `_height`
 * (`main/main.cpp`'s `GLOBAL_DEF_BASIC` pair), which frame a scene with no
 * `project.godot`, as Godot does.
 */
export const DEFAULT_VIEWPORT_WIDTH = 1152;
export const DEFAULT_VIEWPORT_HEIGHT = 648;

/** The project viewport rectangle, in pixels. */
export interface ProjectViewportSize {
  width: number;
  height: number;
}

/**
 * `display/window/size/viewport_*`: the rect a 2D scene is composed against and a root
 * Control anchors to. Per axis, as Godot falls back per setting. A non-finite or
 * non-positive value takes the default: a zero-width viewport cannot be laid out.
 */
export function projectViewportSize(settings: ProjectSettings | null): ProjectViewportSize {
  const axis = (key: string, fallback: number): number => {
    const raw = settings?.[key];
    if (raw === undefined || raw.trim() === '') return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    // Godot stores these as ints; a fractional override would put the capture
    // frame on a half pixel and resample every comparison made against it.
    return Math.round(value);
  };
  return {
    width: axis('display/window/size/viewport_width', DEFAULT_VIEWPORT_WIDTH),
    height: axis('display/window/size/viewport_height', DEFAULT_VIEWPORT_HEIGHT),
  };
}

/**
 * The `internationalization/*` settings `Control::is_layout_rtl()` reads, as the four
 * booleans its branches produce ({@link LayoutDirectionEnv}). Two inputs are plain
 * settings (`core/config/project_settings.cpp:1797-1798`), and the RTL locale table is
 * a fixed seven-code list (`modules/text_server_adv/text_server_adv.cpp:534-541`).
 */
export function projectLayoutDirectionEnv(settings: ProjectSettings | null): LayoutDirectionEnv {
  // `GLOBAL_GET_CACHED(bool, …)` booleanizes whatever the ConfigFile holds, so
  // `1` reads as true exactly like `true` does.
  const forceRtl =
    boolSlotValue(settings?.['internationalization/rendering/force_right_to_left_layout_direction']) === true;
  // The locale comes from `internationalization/locale/test` when set, else the OS
  // (`core/string/translation_server.cpp:592-599`). The OS locale is in no file, so
  // those arms stay left-to-right.
  const testLocale = settings?.['internationalization/locale/test']?.trim() ?? '';
  const applicationLocaleRtl = testLocale !== '' && isLocaleRightToLeft(testLocale);
  // The host's locale, which no scene file states.
  const systemLocaleRtl = false;

  const rootDirection = parseOptionalInt(
    settings?.['internationalization/rendering/root_node_layout_direction']
  );
  const rootRtl =
    rootDirection === 1
      ? false
      : rootDirection === 2
        ? true
        : rootDirection === 3
          ? systemLocaleRtl
          : applicationLocaleRtl;

  return { forceRtl, rootRtl, applicationLocaleRtl, systemLocaleRtl };
}
