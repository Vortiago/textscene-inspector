/** Label registration: native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Label } from './Component';
import { labelMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'Label', Component: Label });
controlSolverRegistry.registerMinimumSize('Label', labelMinimumSize);
// With autowrap ON the minimum height is the text wrapped at this control's
// width, which only a completed pass knows (`SolveContext.tentativeRect`).
controlSolverRegistry.registerSizeDependentMinimum('Label');

export { Label };
