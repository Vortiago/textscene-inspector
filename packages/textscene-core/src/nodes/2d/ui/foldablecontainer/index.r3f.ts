/**
 * FoldableContainer registration — the native (WebGL canvas) rect solve +
 * painter. `./nativeSolver` registers the minimum-size and container-layout
 * functions as a side effect of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { FoldableContainer } from './Component';
import {
  foldableContainerChildVisibility,
  foldableContainerMinimumSize,
  foldableContainerLayout,
  foldableContainerTextureSlots,
} from './nativeSolver';

controlComponentRegistry.register({ typeName: 'FoldableContainer', Component: FoldableContainer });
controlSolverRegistry.registerMinimumSize('FoldableContainer', foldableContainerMinimumSize);
controlSolverRegistry.registerContainerLayout('FoldableContainer', foldableContainerLayout);
controlSolverRegistry.registerTextureSlots('FoldableContainer', foldableContainerTextureSlots);
controlSolverRegistry.registerChildVisibility('FoldableContainer', foldableContainerChildVisibility);

export { FoldableContainer };
