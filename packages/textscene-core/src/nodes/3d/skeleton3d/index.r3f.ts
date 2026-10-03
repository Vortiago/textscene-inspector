/**
 * Skeleton3D poses its bones and runs its modifiers every frame, deforming any mesh bound to it.
 * That drive is a gap here (ADR-0045), so it registers `pending` on the Node3D component.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';

nodeComponentRegistry.register({ typeName: 'Skeleton3D', Component: Node3D, renderIntent: 'pending' });
