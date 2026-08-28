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
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node } from '../../../node/Component';
import { SubViewportContainer } from './Component';

controlComponentRegistry.register({
  typeName: 'SubViewportContainer',
  Component: SubViewportContainer,
});

nodeComponentRegistry.register({
  typeName: 'SubViewportContainer',
  Component: Node,
  container: true,
});

export { SubViewportContainer };
