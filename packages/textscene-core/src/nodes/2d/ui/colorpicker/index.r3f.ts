/**
 * ColorPicker registration. The picker draws nothing itself: every part is an internal Control its
 * constructor builds (`internalControls.ts`), so it paints as the VBoxContainer it extends.
 */
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { registerInternalControls } from '../../../../r3f/controls/native/internalControls';
import { VBoxContainer } from '../vboxcontainer/Component';
import {
  colorPickerContainerLayout,
  colorPickerInternalControls,
  colorPickerInternalLayout,
  colorPickerMinimumSize,
  colorPickerTextureSlots,
} from './internalControls';

controlSolverRegistry.registerMinimumSize('ColorPicker', colorPickerMinimumSize);
controlSolverRegistry.registerTextureSlots('ColorPicker', colorPickerTextureSlots);
controlSolverRegistry.registerContainerLayout('ColorPicker', colorPickerContainerLayout);
registerInternalControls('ColorPicker', colorPickerInternalControls, colorPickerInternalLayout);

controlComponentRegistry.register({ typeName: 'ColorPicker', Component: VBoxContainer });
