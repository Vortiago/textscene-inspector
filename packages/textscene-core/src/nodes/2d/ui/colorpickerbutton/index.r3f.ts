/**
 * ColorPickerButton registration: the native (WebGL canvas) painter, and Button's minimum size and
 * texture slots, since ColorPickerButton overrides no minimum-size method and draws Button's icon.
 * Reusing them also hands the text-shaping `meta` to the `<Button>` chrome.
 */
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { isButtonNodeAutowrapped } from '../../../../r3f/controls/native/buttonBase';
import { buttonMinimumSize, buttonTextureSlots } from '../button/nativeSolver';
import { ColorPickerButton } from './Component';

controlSolverRegistry.registerMinimumSize('ColorPickerButton', buttonMinimumSize);
controlSolverRegistry.registerTextureSlots('ColorPickerButton', buttonTextureSlots);
controlSolverRegistry.registerSizeDependentMinimum('ColorPickerButton', isButtonNodeAutowrapped);

controlComponentRegistry.register({ typeName: 'ColorPickerButton', Component: ColorPickerButton });
