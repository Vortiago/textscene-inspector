/** CheckButton registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CheckButton } from './Component';
import { checkButtonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'CheckButton', Component: CheckButton });
controlSolverRegistry.registerMinimumSize('CheckButton', checkButtonMinimumSize);

export { CheckButton };
