/** Button registration — 2D-overlay DOM component + native (WebGL) painter/solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Button } from './Component';
import { ButtonNative } from './NativeComponent';
import { buttonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'Button', Component: Button, Native: ButtonNative });
controlSolverRegistry.registerMinimumSize('Button', buttonMinimumSize);

export { Button, ButtonNative };
