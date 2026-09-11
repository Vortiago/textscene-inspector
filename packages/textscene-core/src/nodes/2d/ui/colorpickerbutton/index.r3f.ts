/**
 * ColorPickerButton registration — native (WebGL canvas) painter. Its
 * minimum size is Button's own (`Button::get_minimum_size_for_text_and_icon`
 * unmodified — ColorPickerButton overrides no minimum-size method), reused
 * rather than re-derived so its text-shaping `meta` (`nativeSolver.ts`'s own
 * doc) reaches this node's re-used `<Button>` chrome too.
 */
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { buttonMinimumSize } from '../button/nativeSolver';
import { ColorPickerButton } from './Component';

controlSolverRegistry.registerMinimumSize('ColorPickerButton', buttonMinimumSize);

controlComponentRegistry.register({ typeName: 'ColorPickerButton', Component: ColorPickerButton });

export { ColorPickerButton };
