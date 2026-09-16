/** SpinBox registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { SpinBox } from './Component';
import { spinBoxMinimumSize, spinBoxTextureSlots } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'SpinBox', Component: SpinBox });
controlSolverRegistry.registerMinimumSize('SpinBox', spinBoxMinimumSize);
controlSolverRegistry.registerTextureSlots('SpinBox', spinBoxTextureSlots);

export { SpinBox };
