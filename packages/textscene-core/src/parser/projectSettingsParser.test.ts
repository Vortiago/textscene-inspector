/**
 * `project.godot` parsing, pinned against the real file this feature exists for
 * (`scenes/demos/viewport/gui_in_3d/project.godot`) and against Godot's own
 * declaration of the one setting the previewer honours.
 *
 * `scene/theme/theme_db.cpp`, `ThemeDB::initialize_theme()`:
 *
 *     float default_theme_scale = GLOBAL_DEF(PropertyInfo(Variant::FLOAT,
 *     "gui/theme/default_theme_scale", PROPERTY_HINT_RANGE, "0.5,8,0.01",
 *     PROPERTY_USAGE_DEFAULT | PROPERTY_USAGE_RESTART_IF_CHANGED), 1.0);
 *
 * — hence the 1.0 default, and `scene/theme/default_theme.cpp:1369`
 * (`make_default_theme`):
 *
 *     float default_scale = CLAMP(p_scale, 0.5, 8.0);
 *
 * — hence the clamp.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_SCALE,
  parseProjectSettings,
  projectThemeScale,
} from './projectSettingsParser';

/** The head of the real demo project, verbatim — comments, wrap and all. */
const GUI_IN_3D = `; Engine configuration file.
; It's best edited using the editor UI and not directly,
; since the parameters that go here are not all obvious.

config_version=5

[application]

config/name="GUI in 3D"
config/description="A demo showing a GUI instanced within a 3D scene using viewports,
as well as forwarding mouse and keyboard input to the GUI."
run/main_scene="res://gui_in_3d.tscn"

[gui]

theme/default_theme_scale=2.0

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
anti_aliasing/quality/use_debanding=true
`;

describe('parseProjectSettings', () => {
  it('joins the section heading to the key, as ProjectSettings names it', () => {
    const settings = parseProjectSettings(GUI_IN_3D);
    // Godot stores `gui/theme/default_theme_scale` as `theme/default_theme_scale`
    // under `[gui]`; callers address it by the full name.
    expect(settings?.['gui/theme/default_theme_scale']).toBe('2.0');
    expect(settings?.['application/run/main_scene']).toBe('res://gui_in_3d.tscn');
  });

  it('keeps a key above the first heading under its bare name', () => {
    expect(parseProjectSettings(GUI_IN_3D)?.['config_version']).toBe('5');
  });

  it('stores a feature-tagged key, whose name contains a dot', () => {
    const settings = parseProjectSettings(GUI_IN_3D);
    expect(settings?.['rendering/renderer/rendering_method']).toBe('gl_compatibility');
    expect(settings?.['rendering/renderer/rendering_method.mobile']).toBe('gl_compatibility');
  });

  it('unquotes strings and leaves every other value form verbatim', () => {
    const settings = parseProjectSettings(GUI_IN_3D);
    expect(settings?.['application/config/name']).toBe('GUI in 3D');
    expect(settings?.['rendering/anti_aliasing/quality/use_debanding']).toBe('true');
  });

  it('keeps only the first line of a wrapped quoted value, and does not crash on it', () => {
    // Godot wraps `config/description` without escaping the newline. The
    // continuation has no `=`, so it is skipped — deliberate: no setting this
    // previewer reads is multi-line.
    const settings = parseProjectSettings(GUI_IN_3D);
    expect(settings?.['application/config/description']).toBe(
      '"A demo showing a GUI instanced within a 3D scene using viewports,'
    );
    expect(Object.keys(settings ?? {})).not.toContain(
      'as well as forwarding mouse and keyboard input to the GUI."'
    );
  });

  it('ignores comments and blank lines', () => {
    const settings = parseProjectSettings('; a comment\n\n[gui]\n\n; another\nfoo=1\n');
    expect(settings).toEqual({ 'gui/foo': '1' });
  });

  it('returns null for text that carries no setting at all', () => {
    expect(parseProjectSettings('')).toBeNull();
    expect(parseProjectSettings('not an ini file at all')).toBeNull();
    // Headings alone are not settings.
    expect(parseProjectSettings('[gui]\n[rendering]\n')).toBeNull();
  });
});

describe('projectThemeScale', () => {
  it('reads gui/theme/default_theme_scale from the demo project', () => {
    expect(projectThemeScale(parseProjectSettings(GUI_IN_3D))).toBe(2);
  });

  it('defaults to 1.0 without a project, and without the key', () => {
    expect(DEFAULT_THEME_SCALE).toBe(1);
    expect(projectThemeScale(null)).toBe(1);
    expect(projectThemeScale({})).toBe(1);
    expect(projectThemeScale({ 'application/config/name': 'X' })).toBe(1);
  });

  it('clamps to Godot’s CLAMP(p_scale, 0.5, 8.0)', () => {
    expect(projectThemeScale({ 'gui/theme/default_theme_scale': '0.1' })).toBe(0.5);
    expect(projectThemeScale({ 'gui/theme/default_theme_scale': '99' })).toBe(8);
    expect(projectThemeScale({ 'gui/theme/default_theme_scale': '-3' })).toBe(0.5);
  });

  it('falls back to 1.0 on a value that is not a finite number', () => {
    expect(projectThemeScale({ 'gui/theme/default_theme_scale': 'big' })).toBe(1);
    expect(projectThemeScale({ 'gui/theme/default_theme_scale': '' })).toBe(1);
    expect(projectThemeScale({ 'gui/theme/default_theme_scale': 'NaN' })).toBe(1);
  });
});
