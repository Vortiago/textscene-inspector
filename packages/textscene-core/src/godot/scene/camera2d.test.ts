import { describe, it, expect } from 'vitest';
import { CAMERA_2D_ANCHOR_MODE_NAMES, CAMERA_2D_PROCESS_CALLBACK_NAMES } from './camera2d.js';

describe('Camera2D names', () => {
  it('names each anchor mode by its constant', () => {
    expect(CAMERA_2D_ANCHOR_MODE_NAMES).toEqual({ 0: 'FIXED_TOP_LEFT', 1: 'DRAG_CENTER' });
  });

  it('names each process callback without its CAMERA2D_PROCESS prefix', () => {
    expect(CAMERA_2D_PROCESS_CALLBACK_NAMES).toEqual({ 0: 'PHYSICS', 1: 'IDLE' });
  });
});
