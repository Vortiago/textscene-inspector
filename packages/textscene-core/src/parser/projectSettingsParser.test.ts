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
  DEFAULT_VIEWPORT_HEIGHT,
  DEFAULT_VIEWPORT_WIDTH,
  parseProjectSettings,
  projectThemeScale,
  projectViewportSize,
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

/**
 * `display/window/size/viewport_*` — the rect a 2D scene is composed against,
 * and what a root Control resolves its anchors to. 23 of the corpus's 81
 * projects set it: `demos/2d/platformer` is 800x480 and `demos/2d/pong` is
 * 640x400, both of which were being composed against a hardcoded 1152x648.
 */
describe('projectViewportSize', () => {
  it('reads both axes', () => {
    expect(
      projectViewportSize({
        'display/window/size/viewport_width': '800',
        'display/window/size/viewport_height': '480',
      })
    ).toEqual({ width: 800, height: 480 });
  });

  it('defaults to Godot’s 1152x648 without a project, and without the keys', () => {
    expect([DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT]).toEqual([1152, 648]);
    expect(projectViewportSize(null)).toEqual({ width: 1152, height: 648 });
    expect(projectViewportSize({})).toEqual({ width: 1152, height: 648 });
  });

  /** Godot falls back per SETTING, so one axis set must not drag the other. */
  it('falls back per axis', () => {
    expect(projectViewportSize({ 'display/window/size/viewport_width': '640' })).toEqual({
      width: 640,
      height: 648,
    });
    expect(projectViewportSize({ 'display/window/size/viewport_height': '400' })).toEqual({
      width: 1152,
      height: 400,
    });
  });

  /**
   * A zero-width viewport is not a smaller frame — it is a scene that cannot be
   * laid out at all, and it divides by zero in the stage's fit.
   */
  it('rejects a non-positive or non-finite value', () => {
    const width = (raw: string) =>
      projectViewportSize({ 'display/window/size/viewport_width': raw }).width;
    expect(width('0')).toBe(1152);
    expect(width('-800')).toBe(1152);
    expect(width('wide')).toBe(1152);
    expect(width('')).toBe(1152);
    expect(width('NaN')).toBe(1152);
  });

  it('rounds a fractional override — a capture frame is whole pixels', () => {
    expect(projectViewportSize({ 'display/window/size/viewport_width': '800.6' }).width).toBe(801);
  });

  it('reads the keys as `parseProjectSettings` names them, section prefix and all', () => {
    const settings = parseProjectSettings(
      '[display]\n\nwindow/size/viewport_width=640\nwindow/size/viewport_height=400\n'
    );
    expect(projectViewportSize(settings)).toEqual({ width: 640, height: 400 });
  });
});
