/**
 * CenterContainer registration — the native (WebGL canvas) painter + rect
 * solver, self-registered on import (ADR-0001's convention, extended to
 * `controlSolverRegistry` for the native rect solve).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CenterContainer } from './Component';
import { centerContainerMinimumSize, centerContainerLayout } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'CenterContainer',
  Component: CenterContainer,
});
controlSolverRegistry.registerMinimumSize('CenterContainer', centerContainerMinimumSize);
controlSolverRegistry.registerContainerLayout('CenterContainer', centerContainerLayout);

export { CenterContainer };
