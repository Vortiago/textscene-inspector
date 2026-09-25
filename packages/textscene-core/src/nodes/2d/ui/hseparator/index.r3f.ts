/**
 * HSeparator registration: the native (WebGL canvas) painter + minimum-size
 * solver, self-registered on import (ADR-0001).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { HSeparator } from './Component';
import { hSeparatorMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'HSeparator', Component: HSeparator });
controlSolverRegistry.registerMinimumSize('HSeparator', hSeparatorMinimumSize);

export { HSeparator };
