/**
 * Godot `project.godot` parsing — the engine configuration file at a project's
 * `res://` root, holding the settings a scene is authored against.
 *
 * Deliberately NOT `TscnParserCore`: that core scans `[node name="…" type="…"]`
 * headers with attribute lists and carries the `ParseObserver` lint seam, and a
 * `project.godot` has neither — bare `[section]` headings, plain `key=value`
 * lines, and nothing to diagnose. `importParser.ts` already parses this exact
 * INI shape for `.import` sidecars, so this is its sibling rather than a second
 * use of the scene core.
 *
 * Godot writes a setting's full name split across the heading and the key:
 * `gui/theme/default_theme_scale` is stored as `theme/default_theme_scale`
 * under `[gui]`. Parsing rejoins them, so callers address settings by the same
 * name `ProjectSettings.get_setting()` takes. Keys above the first heading
 * (`config_version=5`) have no prefix and keep their bare name.
 *
 * Values stay raw strings, and typed readers are ENUMERATED rather than
 * general: only settings this previewer actually honours get one, so the store
 * cannot quietly become a settings grab-bag.
 */

/**
 * A `key=value` line. The key admits `/` (Godot's subsection separator) and `.`
 * — a feature-tagged override like `renderer/rendering_method.mobile` is a real
 * key, and a pattern that stopped at the dot would leave the line unmatched and
 * silently skipped rather than stored under its own name.
 */
const KEY_VALUE = /^([A-Za-z_][A-Za-z0-9_/.]*)=(.*)$/;
/** A `[section]` heading. Godot's section names are bare identifiers. */
const SECTION = /^\[([A-Za-z_][A-Za-z0-9_]*)\]$/;

/** Raw `project.godot` settings, keyed by full setting name. */
export type ProjectSettings = Readonly<Record<string, string>>;

/**
 * Parse a `project.godot` into its settings, or null when the text is not one.
 *
 * Null rather than a throw because absence and malformedness are both ordinary:
 * most fixtures ship no `project.godot` at all, and a caller's only sensible
 * response either way is "use Godot's defaults".
 *
 * A quoted value spanning several lines (Godot wraps `config/description`
 * without escaping the newline) keeps only its first line: the continuation has
 * no `=` and is skipped. That is deliberate — no setting this previewer reads
 * is multi-line, and reassembling them would mean tracking quote state for no
 * gain.
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

    const pair = KEY_VALUE.exec(line);
    if (!pair) continue;
    const [, key, rawValue] = pair;
    // `config_version` and friends sit above the first heading and are stored
    // under their bare name, exactly as Godot addresses them.
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
 * `gui/theme/default_theme_scale` — the multiplier Godot applies to every
 * metric of the built-in default theme.
 *
 * `scene/theme/theme_db.cpp`, `ThemeDB::initialize_theme()`:
 *
 *     float default_theme_scale = GLOBAL_DEF(PropertyInfo(Variant::FLOAT,
 *     "gui/theme/default_theme_scale", PROPERTY_HINT_RANGE, "0.5,8,0.01",
 *     PROPERTY_USAGE_DEFAULT | PROPERTY_USAGE_RESTART_IF_CHANGED), 1.0);
 *
 * and the value reaches the theme through `make_default_theme(default_theme_scale, …)`,
 * which clamps it — `scene/theme/default_theme.cpp:1369`:
 *
 *     float default_scale = CLAMP(p_scale, 0.5, 8.0);
 *
 * so the clamp is applied HERE, on read, and every metric is rounded after
 * multiplying (see {@link scaledGodotTheme}). An unparseable or non-finite
 * value falls back to 1.0 rather than rendering a collapsed UI.
 */
export function projectThemeScale(settings: ProjectSettings | null): number {
  const raw = settings?.['gui/theme/default_theme_scale'];
  // An empty value is "the key says nothing", not zero — `Number('')` is 0,
  // which is finite and would clamp to 0.5 and shrink the whole UI.
  if (raw === undefined || raw.trim() === '') return DEFAULT_THEME_SCALE;

  const scale = Number(raw);
  if (!Number.isFinite(scale)) return DEFAULT_THEME_SCALE;
  return Math.min(Math.max(scale, 0.5), 8);
}

/**
 * Godot's own defaults for `display/window/size/viewport_width` / `_height`
 * (`main/main.cpp`'s `GLOBAL_DEF_BASIC` pair). A scene with no `project.godot`
 * — every loose unit fixture — is framed at these, which is what Godot does
 * for a project that sets nothing.
 */
export const DEFAULT_VIEWPORT_WIDTH = 1152;
export const DEFAULT_VIEWPORT_HEIGHT = 648;

/** The project viewport rectangle, in pixels. */
export interface ProjectViewportSize {
  width: number;
  height: number;
}

/**
 * `display/window/size/viewport_*` — the rect a 2D scene is composed against,
 * and what a root Control resolves its anchors to.
 *
 * Read per-axis rather than as a pair, because Godot falls back per-setting: a
 * project may set one and leave the other. A non-finite or non-positive value
 * takes the default too — a zero-width viewport is not a smaller frame, it is
 * a scene that cannot be laid out at all.
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
