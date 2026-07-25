/**
 * RemoteTransform2D renders as a transform-only Node2D group: it draws nothing
 * itself (ADR-0008 governs only that). Pushing its transform onto the node its
 * `remote_path` names is resolved by the scene-wide `applyRemoteTransforms`
 * pass (r3f/remoteTransforms.ts) at parse time, which rewrites the TARGET's
 * transform — a static, description-level effect (Godot applies it on
 * enter-tree), so nothing here changes. `canvasItem: true`: Node2D-world
 * content, never drawn in the 3D viewport.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';

nodeComponentRegistry.register({ typeName: 'RemoteTransform2D', Component: Node2D, canvasItem: true });
