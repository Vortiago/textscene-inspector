/** Registers the MarginContainer native painter and rect solver on import (ADR-0001). */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { MarginContainer } from './Component';
import { marginContainerMinimumSize, marginContainerLayout } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'MarginContainer',
  Component: MarginContainer,
});
controlSolverRegistry.registerMinimumSize('MarginContainer', marginContainerMinimumSize);
controlSolverRegistry.registerContainerLayout('MarginContainer', marginContainerLayout);

export { MarginContainer };
