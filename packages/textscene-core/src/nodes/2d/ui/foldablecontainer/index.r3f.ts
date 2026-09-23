/**
 * FoldableContainer registration: the native rect solve and painter. Importing
 * `./nativeSolver` registers the minimum-size and container-layout functions.
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
