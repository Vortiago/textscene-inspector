/**
 * SubViewportContainer registration — the native (WebGL canvas) painter, plus
 * a workspace-neutral pass-through in the 3D registry.
 *
 * Registered in BOTH registries on purpose. `container: true` — a
 * workspace-neutral container — is what it actually is: it passes through in
 * the 3D canvas so a contained sub-viewport's 3D descendants still render, and
 * passes through in the 2D world canvas, where the sub-viewport's own
 * registration blocks the subtree instead.
 *
 * It IS in `TWO_D_UI_TYPES` (that set mirrors the Control registry, and drives
 * the 2D-content hint and the root-workspace rule). The 3D dispatcher subtracts
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
