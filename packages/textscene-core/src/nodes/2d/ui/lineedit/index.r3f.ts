/** LineEdit registration — 2D-overlay DOM component + native (WebGL) painter/solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { LineEdit } from './Component';
import { LineEditNative } from './NativeComponent';
import { lineEditMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'LineEdit', Component: LineEdit, Native: LineEditNative });
controlSolverRegistry.registerMinimumSize('LineEdit', lineEditMinimumSize);

export { LineEdit, LineEditNative };
