/** Button registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Button } from './Component';
import { buttonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'Button', Component: Button });
controlSolverRegistry.registerMinimumSize('Button', buttonMinimumSize);

export { Button };
