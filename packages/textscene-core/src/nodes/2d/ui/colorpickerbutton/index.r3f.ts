/**
 * ColorPickerButton registration: the native (WebGL canvas) painter and
 * Button's minimum size, since ColorPickerButton overrides no minimum-size method.
 * Reusing it also hands the text-shaping `meta` to the `<Button>` chrome.
 */
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { buttonMinimumSize } from '../button/nativeSolver';
import { ColorPickerButton } from './Component';

controlSolverRegistry.registerMinimumSize('ColorPickerButton', buttonMinimumSize);

controlComponentRegistry.register({ typeName: 'ColorPickerButton', Component: ColorPickerButton });

export { ColorPickerButton };
