/**
 * SubViewportContainer registration — the native (WebGL canvas) painter and
 * its minimum size, plus a workspace-neutral pass-through in the 3D registry.
 *
 * The minimum size is registered but no container layout is: this Control
 * imposes no rect on anything (see `nativeSolver.ts`), it only reports how big
 * its sub-viewports make it — which is the whole of what a parent that
 * distributes space needs from it.
 *
 * Registered in BOTH registries on purpose. `container: true` — a
 * workspace-neutral container — is what it actually is: it passes through in
 * the 3D canvas so a contained sub-viewport's 3D descendants still render, and
 * passes through in the 2D world canvas, where the sub-viewport's own
 * registration blocks the subtree instead.
 *
 * It IS a Control, so `is2DUIType` claims it for the 2D-content hint and the
 * root-workspace rule, and it is in `TWO_D_UI_TYPES` because it ships a
 * component. The 3D dispatcher subtracts
 * it separately via `isViewportSurface`, because "is this 2D UI" and "does the
 * 3D canvas skip its subtree" are different questions here — ADR-0033.
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
