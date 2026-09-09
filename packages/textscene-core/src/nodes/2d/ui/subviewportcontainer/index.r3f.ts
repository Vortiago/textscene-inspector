/**
 * SubViewportContainer registration — the 2D-overlay DOM component, plus a
 * workspace-neutral pass-through in the 3D registry.
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
 * 3D canvas skip its subtree" are different questions here — ADR-0030.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { SubViewportContainer } from './Component';
// The 3D pass-through, which the 3D barrel imports directly: this file cannot
// be its home, because it pulls the Control component and so only ever loads
// from the lazy 2D chunk.
import './nodePassthrough.r3f';

controlComponentRegistry.register({
  typeName: 'SubViewportContainer',
  Component: SubViewportContainer,
});

export { SubViewportContainer };
