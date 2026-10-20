import { describe, expect, it } from 'vitest';
import {
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
