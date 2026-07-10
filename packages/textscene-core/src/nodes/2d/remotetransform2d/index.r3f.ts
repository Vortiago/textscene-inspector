/**
 * RemoteTransform2D renders as a transform-only Node2D group (ADR-0008) —
 * it pushes its transform to a remote node but draws nothing itself.
 * `canvasItem: true`: Node2D-world content, never drawn in the 3D viewport.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { RemoteTransform2D } from './Component';

nodeComponentRegistry.register({
  typeName: 'RemoteTransform2D',
  Component: RemoteTransform2D,
  canvasItem: true,
});

export { RemoteTransform2D };
