/** OptionButton registration — 2D-overlay DOM component + native (WebGL) painter/solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { OptionButton } from './Component';
import { OptionButtonNative } from './NativeComponent';
import { optionButtonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'OptionButton', Component: OptionButton, Native: OptionButtonNative });
controlSolverRegistry.registerMinimumSize('OptionButton', optionButtonMinimumSize);

export { OptionButton, OptionButtonNative };
