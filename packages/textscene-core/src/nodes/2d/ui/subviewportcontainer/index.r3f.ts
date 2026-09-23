/**
 * SubViewportContainer registration: the native painter and its minimum size, with no container
 * layout, since it imposes no rect (`nativeSolver.ts`). As a Control it is in `TWO_D_UI_TYPES` and
 * `is2DUIType` claims it, while the 3D dispatcher subtracts it through `isViewportSurface` (ADR-0033).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { SubViewportContainer } from './Component';
// The 3D pass-through, which the 3D barrel imports directly: this file cannot
// be its home, because it pulls the Control component and so only ever loads
// from the lazy 2D chunk.
import './nodePassthrough.r3f';
import { subViewportContainerMinimumSize } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'SubViewportContainer',
  Component: SubViewportContainer,
});
controlSolverRegistry.registerMinimumSize('SubViewportContainer', subViewportContainerMinimumSize);

export { SubViewportContainer };
