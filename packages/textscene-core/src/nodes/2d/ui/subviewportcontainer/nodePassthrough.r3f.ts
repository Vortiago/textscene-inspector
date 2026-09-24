/**
 * SubViewportContainer's 3D-registry entry. `index.r3f.ts` pulls the Control component and loads only
 * from the lazy `r3f/controls/index.ts` chunk, which the 3D view never loads, where the dispatcher
 * would mount a placeholder `GenericNodeFallback` and `isContainer` would answer false. This file
 * imports only `Node`, so the 3D barrel takes it directly.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node } from '../../../node/Component';

nodeComponentRegistry.register({
  typeName: 'SubViewportContainer',
  Component: Node,
  // Workspace-neutral: it passes through in the 3D canvas so a sub-viewport's 3D descendants render,
  // and in the 2D world canvas, where the sub-viewport's own registration blocks the subtree.
  container: true,
  // It is a CanvasItem, and the registry answers what a type is. The workspace question subtracts
  // it elsewhere: `isCanvasItemNode` drops every `isViewportSurface` first (ADR-0030), and
  // `viewportContent` reaches `is2DUIType` first, so the flag is inert at every consumer.
  canvasItem: true,
});
