/** CheckBox registration: the native (WebGL canvas) painter and rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CheckBox } from './Component';
import { checkBoxMinimumSize, checkBoxTextureSlots } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'CheckBox', Component: CheckBox });
controlSolverRegistry.registerMinimumSize('CheckBox', checkBoxMinimumSize);
controlSolverRegistry.registerTextureSlots('CheckBox', checkBoxTextureSlots);
// `autowrap_mode` makes the label's height depend on this node's own width, so
// the minimum reads `SolveContext.tentativeRect`.
controlSolverRegistry.registerSizeDependentMinimum('CheckBox');
