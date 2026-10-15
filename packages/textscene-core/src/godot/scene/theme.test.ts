import { describe, it, expect } from 'vitest';
import {
  CONTROL_FONT_COLOR,
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_HOVER_COLOR,
  CONTROL_FONT_LOW_COLOR,
  CONTROL_FONT_LOWER_COLOR,
  CONTROL_FONT_PLACEHOLDER_COLOR,
  CONTROL_FONT_PRESSED_COLOR,
} from './theme.js';

/** `fill_default_theme` (`scene/theme/default_theme.cpp:101-108`). */
describe('default theme font colours', () => {
  it('draws Control text in a light grey', () => {
    expect(CONTROL_FONT_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 1 });
  });

  it('halves the alpha of disabled text', () => {
    expect(CONTROL_FONT_DISABLED_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 });
  });

  it('draws placeholder text at 0.6 alpha', () => {
    expect(CONTROL_FONT_PLACEHOLDER_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.6 });
  });

  it('dims low text to 0.7 grey', () => {
    expect(CONTROL_FONT_LOW_COLOR).toEqual({ r: 0.7, g: 0.7, b: 0.7, a: 1 });
  });

  it('dims lower text to 0.65 grey', () => {
    expect(CONTROL_FONT_LOWER_COLOR).toEqual({ r: 0.65, g: 0.65, b: 0.65, a: 1 });
  });

  it('brightens hovered text to 0.95 grey', () => {
    expect(CONTROL_FONT_HOVER_COLOR).toEqual({ r: 0.95, g: 0.95, b: 0.95, a: 1 });
  });

  it('draws pressed text in white', () => {
    expect(CONTROL_FONT_PRESSED_COLOR).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});
