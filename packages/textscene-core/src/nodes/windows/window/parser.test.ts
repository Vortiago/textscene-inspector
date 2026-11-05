/**
 * The lenient Window parse: Godot's class defaults, the size its setters leave, and the viewport face
 * the embedder gives an embedded window (`window.cpp:1552-1563`), which the sub-viewport passes read.
 */
import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { SubViewportClearMode, SubViewportUpdateMode } from '../../../godot/scene/viewport';
import { parseWindow } from './parser';

describe('parseWindow', () => {
  it('reads the title, position and size of a Window', () => {
    const result = parseWindow(heading('Window', { name: 'Dialog' }), {
      title: '"Hello window"',
      position: 'Vector2i(100, 120)',
      size: 'Vector2i(300, 200)',
    });
    expect(result.title).toBe('Hello window');
    expect(result.position).toEqual({ x: 100, y: 120 });
    expect(result.size).toEqual({ x: 300, y: 200 });
  });

  it("gives a bare Window Godot's defaults: visible, decorated, 100x100 at the origin", () => {
    const result = parseWindow(heading('Window'), {});
    expect(result).toMatchObject({
      title: '',
      position: { x: 0, y: 0 },
      size: { x: 100, y: 100 },
      visible: true,
      borderless: false,
      transparent_bg: false,
      wrap_controls: false,
      unfocusable: false,
      always_on_top: false,
      exclusive: false,
      force_native: false,
      initial_position: 0,
    });
  });

  it('hides a Popup and drops its border unless the scene says otherwise', () => {
    expect(parseWindow(heading('Popup'), {})).toMatchObject({
      visible: false,
      borderless: true,
      wrap_controls: true,
    });
    expect(parseWindow(heading('Popup'), { visible: 'true', borderless: 'false' })).toMatchObject({
      visible: true,
      borderless: false,
    });
  });

  it('gives a PopupPanel a transparent background (popup.cpp:430, window.cpp:548-549)', () => {
    expect(parseWindow(heading('PopupPanel'), {}).transparent_bg).toBe(true);
  });

  it('lets a PopupPanel line clear the background its constructor makes transparent', () => {
    expect(parseWindow(heading('PopupPanel'), { transparent_bg: 'false' }).transparent_bg).toBe(false);
  });

  it('clears a transparent Window to nothing, as set_flag(FLAG_TRANSPARENT) does', () => {
    expect(parseWindow(heading('Window'), { transparent: 'true' }).transparent_bg).toBe(true);
  });

  it('replays the size lines in file order', () => {
    const result = parseWindow(heading('Window'), {
      size: 'Vector2i(10, 10)',
      min_size: 'Vector2i(20, 5)',
    });
    expect(result.size).toEqual({ x: 20, y: 10 });
    expect(result.min_size).toEqual({ x: 20, y: 5 });
  });

  it('skips a malformed size line', () => {
    expect(parseWindow(heading('Window'), { size: 'Vector2i(nope)' }).size).toEqual({ x: 100, y: 100 });
  });

  it('updates a visible window with its parent and never a hidden one (window.cpp:1562, :3578)', () => {
    expect(parseWindow(heading('Window'), {}).render_target_update_mode).toBe(
      SubViewportUpdateMode.WHEN_PARENT_VISIBLE
    );
    expect(parseWindow(heading('Window'), { visible: 'false' }).render_target_update_mode).toBe(
      SubViewportUpdateMode.DISABLED
    );
    expect(parseWindow(heading('Window'), {}).render_target_clear_mode).toBe(SubViewportClearMode.ALWAYS);
  });

  it('carries the theme and the theme overrides the decoration reads', () => {
    const result = parseWindow(heading('Window'), {
      theme: 'ExtResource("1")',
      'theme_override_styles/embedded_border': 'SubResource("2")',
      'theme_override_constants/title_height': '40',
    });
    expect(result.theme).toBe('ExtResource("1")');
    expect(result.themeOverrideStyles).toEqual({ embedded_border: 'SubResource("2")' });
    expect(result.themeOverrideConstants).toEqual({ title_height: 40 });
  });

  it('reads the Viewport keys a Window inherits', () => {
    expect(parseWindow(heading('Window'), { own_world_3d: 'true' }).own_world_3d).toBe(true);
  });

  it('reads the content scale, unscaled by default', () => {
    expect(parseWindow(heading('Window'), {}).content_scale).toEqual({
      mode: 0,
      aspect: 0,
      stretch: 0,
      size: { x: 0, y: 0 },
      factor: 1,
    });
    const scaled = parseWindow(heading('Window'), {
      content_scale_mode: '1',
      content_scale_aspect: '4',
      content_scale_stretch: '1',
      content_scale_size: 'Vector2i(120, 60)',
      content_scale_factor: '1.5',
    }).content_scale;
    expect(scaled).toEqual({ mode: 1, aspect: 4, stretch: 1, size: { x: 120, y: 60 }, factor: 1.5 });
  });

  it('keeps the defaults for a factor or a size the setters refuse (`window.cpp:1716,1774`)', () => {
    const scale = parseWindow(heading('Window'), {
      content_scale_factor: '0',
      content_scale_size: 'Vector2i(-1, 60)',
    }).content_scale;
    expect({ factor: scale.factor, size: scale.size }).toEqual({ factor: 1, size: { x: 0, y: 0 } });
  });

  it('shares only frozen vectors between windows that leave the keys unset', () => {
    const result = parseWindow(heading('Window'), {});
    expect(Object.isFrozen(result.position)).toBe(true);
    expect(Object.isFrozen(result.size_2d_override)).toBe(true);
    expect(Object.isFrozen(result.content_scale.size)).toBe(true);
  });
});
