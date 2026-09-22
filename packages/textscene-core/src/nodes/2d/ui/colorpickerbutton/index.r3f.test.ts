/**
 * ColorPickerButton self-registration: importing `index.r3f` must wire the
 * native (WebGL canvas) painter and Button's reused minimum-size solver.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { buttonMinimumSize } from '../button/nativeSolver';
import { ColorPickerButton } from './Component';

describe('ColorPickerButton index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('ColorPickerButton')).toBe(ColorPickerButton);
  });

  it("registers Button's own minimum-size solver, reused rather than re-derived", () => {
    expect(controlSolverRegistry.minimumSize('ColorPickerButton')).toBe(buttonMinimumSize);
  });
});
