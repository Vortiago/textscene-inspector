/** Button registration: the native (WebGL canvas) painter and rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { isButtonNodeAutowrapped } from '../../../../r3f/controls/native/buttonBase';
import { Button } from './Component';
import { buttonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'Button', Component: Button });
controlSolverRegistry.registerMinimumSize('Button', buttonMinimumSize);
// `autowrap_mode` makes the label's height depend on this node's own width, so
// the minimum reads `SolveContext.tentativeRect`, for a wrapping node only.
controlSolverRegistry.registerSizeDependentMinimum('Button', isButtonNodeAutowrapped);
