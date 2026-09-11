/**
 * ColorPicker self-registration: importing `index.r3f` must wire the native
 * (WebGL canvas) painter and its minimum-size solver.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ColorPicker } from './Component';
import { colorPickerMinimumSize } from './nativeSolver';

describe('ColorPicker index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('ColorPicker')).toBe(ColorPicker);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('ColorPicker')).toBe(colorPickerMinimumSize);
  });
});
