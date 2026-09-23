/**
 * VSeparator registration: the native (WebGL canvas) painter and minimum-size solver,
 * self-registered on import (ADR-0001).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { VSeparator } from './Component';
import { vSeparatorMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'VSeparator', Component: VSeparator });
controlSolverRegistry.registerMinimumSize('VSeparator', vSeparatorMinimumSize);

export { VSeparator };
