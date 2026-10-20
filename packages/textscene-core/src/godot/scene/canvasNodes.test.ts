import { describe, it, expect } from 'vitest';
import { BACK_BUFFER_COPY_MODE_NAMES, TOUCH_SCREEN_BUTTON_VISIBILITY_MODE_NAMES } from './canvasNodes.js';

describe('2D canvas node names', () => {
  it('names each back buffer copy mode as `back_buffer_copy.cpp:98` hints it', () => {
    expect(BACK_BUFFER_COPY_MODE_NAMES).toEqual({ 0: 'Disabled', 1: 'Rect', 2: 'Viewport' });
  });

  it('names each touch screen button visibility mode without its VISIBILITY prefix', () => {
    expect(TOUCH_SCREEN_BUTTON_VISIBILITY_MODE_NAMES).toEqual({ 0: 'ALWAYS', 1: 'TOUCHSCREEN_ONLY' });
  });
});
