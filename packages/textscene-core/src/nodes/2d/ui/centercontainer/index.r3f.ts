/**
 * CenterContainer registration: the native (WebGL canvas) painter and rect
 * solver, self-registered on import (ADR-0001), the solver in `controlSolverRegistry`.
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
