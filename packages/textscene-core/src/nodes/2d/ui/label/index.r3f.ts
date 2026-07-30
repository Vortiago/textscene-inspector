/** Label registration — 2D-overlay DOM component + native (WebGL) painter/solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Label } from './Component';
import { LabelNative } from './NativeComponent';
import { labelMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'Label', Component: Label, Native: LabelNative });
controlSolverRegistry.registerMinimumSize('Label', labelMinimumSize);

export { Label, LabelNative };
