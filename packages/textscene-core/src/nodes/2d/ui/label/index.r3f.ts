/** Label registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Label } from './Component';
import { labelMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'Label', Component: Label });
controlSolverRegistry.registerMinimumSize('Label', labelMinimumSize);
// With autowrap ON the minimum HEIGHT is the height of the text as wrapped at
// this control's own width, which only a completed pass knows — read through
// `SolveContext.tentativeRect`, see `nativeSolver.ts`'s own doc and
// `solverRegistry.ts`'s `tentativeRect`.
controlSolverRegistry.registerSizeDependentMinimum('Label');

export { Label };
