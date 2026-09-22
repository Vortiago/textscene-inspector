/** OptionButton registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { OptionButton } from './Component';
import { optionButtonMinimumSize, optionButtonTextureSlots } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'OptionButton', Component: OptionButton });
controlSolverRegistry.registerMinimumSize('OptionButton', optionButtonMinimumSize);
controlSolverRegistry.registerTextureSlots('OptionButton', optionButtonTextureSlots);

export { OptionButton };
