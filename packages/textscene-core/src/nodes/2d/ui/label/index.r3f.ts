/** Label registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Label } from './Component';
import { labelMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'Label', Component: Label });
controlSolverRegistry.registerMinimumSize('Label', labelMinimumSize);

export { Label };
