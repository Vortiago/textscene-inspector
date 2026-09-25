/**
 * Registers the native (WebGL canvas) painter for ScrollContainer and its
 * minimum-size and container-layout solvers. `wrapsChildren` makes the
 * descendants React children, so the painter's clip-plane scope reaches them.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ScrollContainer } from './Component';
import { scrollContainerLayout, scrollContainerMinimumSize } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'ScrollContainer',
  Component: ScrollContainer,
  wrapsChildren: true,
});
controlSolverRegistry.registerMinimumSize('ScrollContainer', scrollContainerMinimumSize);
controlSolverRegistry.registerContainerLayout('ScrollContainer', scrollContainerLayout);

export { ScrollContainer };
