import { describe, it, expect } from 'vitest';
import {
  LIGHT_2D_BLEND_MODE_NAMES,
  LIGHT_2D_SHADOW_FILTER_HINT_NAMES,
  LIGHT_2D_SHADOW_FILTER_NAMES,
} from './light2d.js';

describe('Light2D names', () => {
  it('names each blend mode by its constant', () => {
    expect(LIGHT_2D_BLEND_MODE_NAMES).toEqual({ 0: 'ADD', 1: 'SUB', 2: 'MIX' });
  });

  it('names each shadow filter by its constant, SHADOW_FILTER_MAX left out', () => {
    expect(LIGHT_2D_SHADOW_FILTER_NAMES).toEqual({ 0: 'NONE', 1: 'PCF5', 2: 'PCF13' });
  });

  it('names each shadow filter as `light_2d.cpp:318` hints it', () => {
    expect(LIGHT_2D_SHADOW_FILTER_HINT_NAMES).toEqual({ 0: 'None', 1: 'PCF5', 2: 'PCF13' });
  });
});
