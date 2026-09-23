/** CheckButton registration: the native (WebGL canvas) painter and rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CheckButton } from './Component';
import { checkButtonMinimumSize, checkButtonTextureSlots } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'CheckButton', Component: CheckButton });
controlSolverRegistry.registerMinimumSize('CheckButton', checkButtonMinimumSize);
controlSolverRegistry.registerTextureSlots('CheckButton', checkButtonTextureSlots);

export { CheckButton };
