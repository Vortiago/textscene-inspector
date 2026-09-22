/**
 * ScrollContainer registration — the native (WebGL canvas) painter, and the
 * native rect solver's minimum-size/container-layout registrations
 * `nativeSolver.ts` exports.
 *
 * `wrapsChildren: true` — the second type (after `CanvasLayer`) that needs
 * it: `ScrollContainer` establishes a NEW ambient clip-plane scope for
 * its subtree (`ControlClipProvider`), which only reaches descendants if the
 * walker renders them as this painter's REACT children rather than as
 * siblings.
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
