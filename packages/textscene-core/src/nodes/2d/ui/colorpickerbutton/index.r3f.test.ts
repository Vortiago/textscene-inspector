/**
 * ColorPickerButton self-registration: importing `index.r3f` must wire the
 * native (WebGL canvas) painter and Button's reused minimum-size solver and texture slots.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { buttonMinimumSize, buttonTextureSlots } from '../button/nativeSolver';
import { ColorPickerButton } from './Component';

describe('ColorPickerButton index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('ColorPickerButton')).toBe(ColorPickerButton);
  });

  it("registers Button's own minimum-size solver, reused rather than re-derived", () => {
    expect(controlSolverRegistry.minimumSize('ColorPickerButton')).toBe(buttonMinimumSize);
  });

  it("registers Button's texture slots, so the theme icon `icon` has a size (button.cpp:37-40)", () => {
    expect(controlSolverRegistry.textureSlots('ColorPickerButton')).toBe(buttonTextureSlots);
  });
});
