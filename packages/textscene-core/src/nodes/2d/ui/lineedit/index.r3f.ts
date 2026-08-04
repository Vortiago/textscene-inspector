/** LineEdit registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { LineEdit } from './Component';
import { lineEditMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'LineEdit', Component: LineEdit });
controlSolverRegistry.registerMinimumSize('LineEdit', lineEditMinimumSize);

export { LineEdit };
