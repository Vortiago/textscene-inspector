/** CheckBox registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CheckBox } from './Component';
import { checkBoxMinimumSize, checkBoxTextureSlots } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'CheckBox', Component: CheckBox });
controlSolverRegistry.registerMinimumSize('CheckBox', checkBoxMinimumSize);
controlSolverRegistry.registerTextureSlots('CheckBox', checkBoxTextureSlots);

export { CheckBox };
