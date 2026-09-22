/**
 * ColorPicker registration — native (WebGL canvas) painter and minimum-size
 * solver (`./nativeSolver`'s own doc for what it does and does not model).
 */
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ColorPicker } from './Component';
import { colorPickerMinimumSize } from './nativeSolver';

controlSolverRegistry.registerMinimumSize('ColorPicker', colorPickerMinimumSize);

controlComponentRegistry.register({ typeName: 'ColorPicker', Component: ColorPicker });

export { ColorPicker };
