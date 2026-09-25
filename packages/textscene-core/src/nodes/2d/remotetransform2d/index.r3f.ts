/**
 * RemoteTransform2D draws nothing (ADR-0008), so it renders as a transform-only
 * Node2D group. Its `scenePass`, shared with the 3D relay, rewrites the
 * `remote_path` target's transform once per parse, as Godot does on enter-tree.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { applyRemoteTransforms } from '../../3d/remotetransform3d/remoteTransforms';

nodeComponentRegistry.register({
  typeName: 'RemoteTransform2D',
  Component: Node2D,
  canvasItem: true,
  renderIntent: 'transform-only',
  scenePass: { stage: 'transforms', run: applyRemoteTransforms },
});
