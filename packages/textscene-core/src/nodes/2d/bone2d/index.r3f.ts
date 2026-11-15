/**
 * Bone2D draws the editor kite from itself to each Bone2D child (ADR-0056), and positions its
 * children as a Node2D does.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Bone2D } from './Component';

nodeComponentRegistry.register({ typeName: 'Bone2D', Component: Bone2D, canvasItem: true });
