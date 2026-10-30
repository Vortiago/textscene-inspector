/**
 * RemoteTransform3D draws nothing, so it renders as a transform-only Node3D group
 * (ADR-0008). Its push onto the `remote_path` target is the `scenePass`
 * (`remoteTransforms.ts`), applied over the Live scene tree as Godot does on enter-tree.
 * Neither `canvasItem` nor `container`: like Area3D, it is drawn only in 3D.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';

nodeComponentRegistry.register({
  typeName: 'RemoteTransform3D',
  Component: Node3D,
  renderIntent: 'transform-only',
  scenePass: true,
});
