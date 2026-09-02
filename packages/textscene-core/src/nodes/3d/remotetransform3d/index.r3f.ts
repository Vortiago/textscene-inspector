/**
 * RemoteTransform3D renders as a transform-only Node3D group: it draws nothing
 * itself (ADR-0008 governs only that — drawing nothing). What it DOES do — push
 * its transform onto the node its `remote_path` names — is the `scenePass`
 * registered here (`remoteTransforms.ts`), which rewrites the TARGET's
 * transform once per parse. That is a static, description-
 * level effect (Godot applies it on enter-tree), not something this render
 * component does, so nothing here changes. Registered as neither `canvasItem`
 * nor `container`: a pure 3D-only type, like Area3D — only drawn in the 3D
 * viewport.
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
