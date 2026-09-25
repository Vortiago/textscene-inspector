/**
 * RemoteTransform3D draws nothing, so it renders as a transform-only Node3D group
 * (ADR-0008). Its push onto the `remote_path` target is the `scenePass`
 * (`remoteTransforms.ts`), applied once per parse as Godot does on enter-tree.
 * Neither `canvasItem` nor `container`: like Area3D, it is drawn only in 3D.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { applyRemoteTransforms } from './remoteTransforms';

nodeComponentRegistry.register({
  typeName: 'RemoteTransform3D',
  Component: Node3D,
  renderIntent: 'transform-only',
  scenePass: { stage: 'transforms', run: applyRemoteTransforms },
});
