/** Button registration: the native (WebGL canvas) painter and rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Button } from './Component';
import { buttonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'Button', Component: Button });
controlSolverRegistry.registerMinimumSize('Button', buttonMinimumSize);
// `autowrap_mode` makes the label's height depend on this node's own width, so
// the minimum reads `SolveContext.tentativeRect`.
controlSolverRegistry.registerSizeDependentMinimum('Button');

export { Button };
