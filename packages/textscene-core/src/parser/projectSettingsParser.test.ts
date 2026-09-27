/**
 * `project.godot` parsing, pinned against `scenes/demos/viewport/gui_in_3d/project.godot`
 * and Godot's declaration of `gui/theme/default_theme_scale`: default 1.0
 * (`ThemeDB::initialize_theme()` in `scene/theme/theme_db.cpp`), clamped to 0.5-8 by
 * `make_default_theme` (`scene/theme/default_theme.cpp:1369`).
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_SCALE,
  DEFAULT_VIEWPORT_HEIGHT,
  DEFAULT_VIEWPORT_WIDTH,
  parseProjectSettings,
  projectLayoutDirectionEnv,
  projectThemeScale,
  projectViewportSize,
} from './projectSettingsParser';

/** The head of the real demo project, verbatim, comments and wrap included. */
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

  it('decodes the escapes Godot writes into a string', () => {
    // `c_escape_multiline` (`ustring.cpp:4493-4499`) escapes `\` and `"`, and
    // `VariantParser` decodes them when ProjectSettings loads the file.
    const settings = parseProjectSettings(
      '[application]\n\nconfig/name="Say \\"hi\\""\nconfig/icon="res://a\\\\b.svg"\n'
    );
    expect(settings?.['application/config/name']).toBe('Say "hi"');
    expect(settings?.['application/config/icon']).toBe('res://a\\b.svg');
  });

  it('reads a StringName as its text', () => {
    const settings = parseProjectSettings('[input]\n\nui_default=&"ui_accept"\n');
    expect(settings?.['input/ui_default']).toBe('ui_accept');
  });

  it('keeps a value whose trailing quote is escaped as written, since it never closes', () => {
    const settings = parseProjectSettings('[application]\n\nconfig/name="unclosed\\"\n');
    expect(settings?.['application/config/name']).toBe('"unclosed\\"');
  });

  it('keeps only the first line of a wrapped quoted value, and does not crash on it', () => {
    // Godot wraps `config/description` without escaping the newline. The
    // continuation has no `=`, so it is skipped: no setting this previewer reads is
    // multi-line.
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
 * `display/window/size/viewport_*`: the rect a 2D scene is composed against and a root
 * Control anchors to. `demos/2d/platformer` sets 800x480 and `demos/2d/pong` 640x400.
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
   * A zero-width viewport cannot be laid out, and it divides by zero in the stage's fit.
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

describe('projectLayoutDirectionEnv', () => {
  it('answers Godot\'s own defaults without a project file', () => {
    // Both default off and 0 (`core/config/project_settings.cpp:1797-1798`). Arm 0 is
    // "Based on Application Locale", and with no `internationalization/locale/test`
    // that is the OS locale, which this previewer cannot read.
    expect(projectLayoutDirectionEnv(null)).toEqual({
      forceRtl: false,
      rootRtl: false,
      applicationLocaleRtl: false,
      systemLocaleRtl: false,
    });
  });

  it('reads the force flag, which the two locale arms honour', () => {
    expect(
      projectLayoutDirectionEnv({
        'internationalization/rendering/force_right_to_left_layout_direction': 'true',
      }).forceRtl
    ).toBe(true);
  });

  it('resolves the root direction from `root_node_layout_direction`', () => {
    // `control.cpp:3600-3608`: 1 => LTR, 2 => RTL, 3 => system locale,
    // anything else => the application locale.
    const root = (value: string) =>
      projectLayoutDirectionEnv({
        'internationalization/rendering/root_node_layout_direction': value,
      }).rootRtl;
    expect(root('1')).toBe(false);
    expect(root('2')).toBe(true);
    expect(root('3')).toBe(false);
    expect(root('0')).toBe(false);
  });

  it('reads the application locale from `internationalization/locale/test`', () => {
    // `Object::_get_locale()` (`core/object/object.cpp:1793-1804`) ends at
    // `TranslationServer::get_locale()`, which `setup()` seeds from the test
    // locale when one is set (`core/string/translation_server.cpp:592-599`).
    const settings = { 'internationalization/locale/test': 'he_IL' };
    expect(projectLayoutDirectionEnv(settings).applicationLocaleRtl).toBe(true);
    // The root's own arm 0 goes through the same locale.
    expect(
      projectLayoutDirectionEnv({
        ...settings,
        'internationalization/rendering/root_node_layout_direction': '0',
      }).rootRtl
    ).toBe(true);
    // Arm 3 is the SYSTEM locale, which the test locale never stands in for.
    expect(
      projectLayoutDirectionEnv({
        ...settings,
        'internationalization/rendering/root_node_layout_direction': '3',
      }).rootRtl
    ).toBe(false);
  });

  it('leaves the system-locale answer false — the host locale is not in the scene', () => {
    expect(
      projectLayoutDirectionEnv({ 'internationalization/locale/test': 'ar' }).systemLocaleRtl
    ).toBe(false);
  });

  it('ignores a blank test locale, which `setup()` strips before testing it', () => {
    // `test = test.strip_edges(); if (!test.is_empty())`
    // (`translation_server.cpp:593-595`).
    expect(
      projectLayoutDirectionEnv({ 'internationalization/locale/test': '   ' }).applicationLocaleRtl
    ).toBe(false);
  });
});

describe('projectLayoutDirectionEnv — the settings are engine slots, not text', () => {
  it('booleanizes the force flag, so an int spelling reads like `true`', () => {
    // `GLOBAL_GET_CACHED(bool, …)` converts whatever the ConfigFile parsed
    // (`variant.cpp:550-558`), so `1` is true and `0` is false.
    const force = (value: string) =>
      projectLayoutDirectionEnv({
        'internationalization/rendering/force_right_to_left_layout_direction': value,
      }).forceRtl;
    expect(force('1')).toBe(true);
    expect(force('0')).toBe(false);
    expect(force('false')).toBe(false);
  });

  it('truncates the root direction the way the INT slot does', () => {
    // `_to_int` (`core/variant/variant.h:360-377`) runs before the comparison.
    expect(
      projectLayoutDirectionEnv({
        'internationalization/rendering/root_node_layout_direction': '2.9',
      }).rootRtl
    ).toBe(true);
    // An unreadable value stores 0, which is the application-locale arm.
    expect(
      projectLayoutDirectionEnv({
        'internationalization/rendering/root_node_layout_direction': 'nonsense',
      }).rootRtl
    ).toBe(false);
  });
});
