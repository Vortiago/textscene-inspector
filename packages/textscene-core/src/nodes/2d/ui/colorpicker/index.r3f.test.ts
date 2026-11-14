/** ColorPicker self-registration: importing `index.r3f` wires its painter, its solver hooks and its internal Controls. */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { VBoxContainer } from '../vboxcontainer/Component';
import { colorPickerMinimumSize, colorPickerTextureSlots } from './internalControls';

describe('ColorPicker index.r3f self-registration', () => {
  it('paints as the VBoxContainer it extends, since it draws nothing itself', () => {
    expect(controlComponentRegistry.get('ColorPicker')).toBe(VBoxContainer);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('ColorPicker')).toBe(colorPickerMinimumSize);
  });

  it('registers the texture slots of its themed icons', () => {
    expect(controlSolverRegistry.textureSlots('ColorPicker')).toBe(colorPickerTextureSlots);
  });
});
