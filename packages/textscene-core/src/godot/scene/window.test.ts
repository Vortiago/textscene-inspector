import { describe, expect, it } from 'vitest';
import {
  centredWindowPosition,
  embeddedWindowSize,
  replayWindowSize,
  windowClassDefaults,
  WINDOW_CONTENT_SCALE_ASPECT_NAMES,
  WINDOW_CONTENT_SCALE_MODE_NAMES,
  WINDOW_CONTENT_SCALE_STRETCH_NAMES,
  WINDOW_INITIAL_POSITION_NAMES,
  WINDOW_MODE_NAMES,
} from './window.js';

describe('WINDOW_MODE_NAMES', () => {
  it('names the five modes without MODE_ (window.h:48-54, 4.7.2 :47-53)', () => {
    expect(WINDOW_MODE_NAMES).toEqual({
      0: 'WINDOWED',
      1: 'MINIMIZED',
      2: 'MAXIMIZED',
      3: 'FULLSCREEN',
      4: 'EXCLUSIVE_FULLSCREEN',
    });
  });
});

describe('WINDOW_INITIAL_POSITION_NAMES', () => {
  it('names the six positions without WINDOW_INITIAL_POSITION_ (window.h:109-116, 4.7.2 :108-115)', () => {
    expect(WINDOW_INITIAL_POSITION_NAMES).toEqual({
      0: 'ABSOLUTE',
      1: 'CENTER_PRIMARY_SCREEN',
      2: 'CENTER_MAIN_WINDOW_SCREEN',
      3: 'CENTER_OTHER_SCREEN',
      4: 'CENTER_SCREEN_WITH_MOUSE_FOCUS',
      5: 'CENTER_SCREEN_WITH_KEYBOARD_FOCUS',
    });
  });
});

describe('WINDOW_CONTENT_SCALE_MODE_NAMES', () => {
  it('names the three modes without CONTENT_SCALE_MODE_ (window.h:73-77, 4.7.2 :72-76)', () => {
    expect(WINDOW_CONTENT_SCALE_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'CANVAS_ITEMS', 2: 'VIEWPORT' });
  });
});

describe('WINDOW_CONTENT_SCALE_ASPECT_NAMES', () => {
  it('names the five aspects without CONTENT_SCALE_ASPECT_ (window.h:79-85, 4.7.2 :78-84)', () => {
    expect(WINDOW_CONTENT_SCALE_ASPECT_NAMES).toEqual({
      0: 'IGNORE',
      1: 'KEEP',
      2: 'KEEP_WIDTH',
      3: 'KEEP_HEIGHT',
      4: 'EXPAND',
    });
  });
});

describe('WINDOW_CONTENT_SCALE_STRETCH_NAMES', () => {
  it('names the two stretches without CONTENT_SCALE_STRETCH_ (window.h:87-90, 4.7.2 :86-89)', () => {
    expect(WINDOW_CONTENT_SCALE_STRETCH_NAMES).toEqual({ 0: 'FRACTIONAL', 1: 'INTEGER' });
  });
});

describe('windowClassDefaults', () => {
  it('keeps a Window visible and decorated (window.h:126-140)', () => {
    expect(windowClassDefaults('Window')).toEqual({
      visible: true,
      wrapControls: false,
      borderless: false,
      transparent: false,
    });
  });

  it('hides a Popup, drops its border and wraps its Controls (popup.cpp:215-225)', () => {
    expect(windowClassDefaults('Popup')).toEqual({
      visible: false,
      wrapControls: true,
      borderless: true,
      transparent: false,
    });
  });

  it('makes a PopupPanel transparent on top of the Popup defaults (popup.cpp:430)', () => {
    expect(windowClassDefaults('PopupPanel').transparent).toBe(true);
    expect(windowClassDefaults('PopupPanel').visible).toBe(false);
  });
});

describe('replayWindowSize', () => {
  it('keeps an authored size inside the limits', () => {
    expect(replayWindowSize([{ key: 'size', value: { x: 300, y: 200 } }])).toEqual({ x: 300, y: 200 });
  });

  it("gives Godot's 100x100 default with no size line", () => {
    expect(replayWindowSize([])).toEqual({ x: 100, y: 100 });
  });

  it('raises the size to a later min_size, axis by axis', () => {
    const writes = [
      { key: 'size', value: { x: 10, y: 10 } },
      { key: 'min_size', value: { x: 20, y: 5 } },
    ] as const;
    expect(replayWindowSize(writes)).toEqual({ x: 20, y: 10 });
  });

  it('keeps the cap an earlier max_size applied after a later min_size invalidates it', () => {
    const writes = [
      { key: 'size', value: { x: 50, y: 50 } },
      { key: 'max_size', value: { x: 40, y: 40 } },
      { key: 'min_size', value: { x: 45, y: 45 } },
    ] as const;
    expect(replayWindowSize(writes)).toEqual({ x: 45, y: 45 });
  });

  it('floors a negative limit at 0 before it clamps', () => {
    const writes = [
      { key: 'size', value: { x: 30, y: 30 } },
      { key: 'min_size', value: { x: -5, y: 40 } },
    ] as const;
    expect(replayWindowSize(writes)).toEqual({ x: 30, y: 40 });
  });
});

describe('embeddedWindowSize', () => {
  const limits = { minSize: { x: 0, y: 0 }, maxSize: { x: 0, y: 0 } };

  it('grows a wrap_controls window to its contents (measured: 200x100 around a 420x310 child)', () => {
    const size = embeddedWindowSize(
      { x: 200, y: 100 },
      { ...limits, wrapControls: true },
      { x: 420, y: 310 }
    );
    expect(size).toEqual({ x: 420, y: 310 });
  });

  it('ignores the contents without wrap_controls', () => {
    const size = embeddedWindowSize(
      { x: 200, y: 100 },
      { ...limits, wrapControls: false },
      { x: 420, y: 310 }
    );
    expect(size).toEqual({ x: 200, y: 100 });
  });

  it('caps the wrapped size at a valid max_size', () => {
    const size = embeddedWindowSize(
      { x: 200, y: 100 },
      { minSize: { x: 0, y: 0 }, maxSize: { x: 300, y: 300 }, wrapControls: true },
      { x: 420, y: 310 }
    );
    expect(size).toEqual({ x: 300, y: 300 });
  });

  it('holds an embedded window at 1 pixel at least (window.cpp:1208)', () => {
    const size = embeddedWindowSize({ x: 0, y: 0 }, { ...limits, wrapControls: false }, { x: 0, y: 0 });
    expect(size).toEqual({ x: 1, y: 1 });
  });
});

describe('centredWindowPosition', () => {
  it('centres the window in its embedder (measured: 476,274 for 200x100 in 1152x648)', () => {
    expect(centredWindowPosition({ x: 1152, y: 648 }, { x: 200, y: 100 })).toEqual({ x: 476, y: 274 });
  });

  it('truncates an odd remainder as Vector2i division does', () => {
    expect(centredWindowPosition({ x: 1152, y: 648 }, { x: 201, y: 101 })).toEqual({ x: 475, y: 273 });
  });

  it('truncates toward zero for a window larger than its embedder', () => {
    expect(centredWindowPosition({ x: 1152, y: 648 }, { x: 1201, y: 649 })).toEqual({ x: -24, y: 0 });
  });
});
