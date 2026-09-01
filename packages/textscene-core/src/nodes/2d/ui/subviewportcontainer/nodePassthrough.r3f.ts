/**
 * SubViewportContainer's 3D-registry entry, apart from the slice's own
 * `index.r3f.ts`.
 *
 * Its own file because the two registrations reach the app by different roads.
 * `index.r3f.ts` pulls the Control component, so it can only be imported from
 * `r3f/controls/index.ts` — a chunk both of whose importers are `lazy()`, and
 * neither of which loads in the 3D viewport at all. Registering the 3D
 * pass-through there left `nodeComponentRegistry.get('SubViewportContainer')`
 * undefined in 3D mode: the dispatcher mounted `GenericNodeFallback`, which
 * stamps `userData.isPlaceholder` on a type this slice deliberately declares as
 * a real container, and `isContainer` answered false to every consumer.
 *
 * Nothing but `Node` is imported here, so the 3D barrel can take it directly.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node } from '../../../node/Component';

nodeComponentRegistry.register({
  typeName: 'SubViewportContainer',
  Component: Node,
  container: true,
  // It IS a CanvasItem, and the registry answers what a type IS. The workspace
  // question is asked elsewhere and already subtracts this type on its own
  // terms: `isCanvasItemNode` drops every `isViewportSurface` before consulting
  // this flag (ADR-0030), and `viewportContent` reaches `is2DUIType` first. So
  // the flag is inert at every consumer and the registration stops lying.
  canvasItem: true,
});
