/** CheckBox registration — 2D-overlay DOM component + native (WebGL) painter/solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CheckBox } from './Component';
import { CheckBoxNative } from './NativeComponent';
import { checkBoxMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'CheckBox', Component: CheckBox, Native: CheckBoxNative });
controlSolverRegistry.registerMinimumSize('CheckBox', checkBoxMinimumSize);

export { CheckBox, CheckBoxNative };
