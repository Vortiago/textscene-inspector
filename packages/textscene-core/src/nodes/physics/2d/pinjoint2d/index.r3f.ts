/** PinJoint2D draws its editor marker for every node (ADR-0056). */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { PinJoint2D } from './Component';

nodeComponentRegistry.register({ typeName: 'PinJoint2D', Component: PinJoint2D, canvasItem: true });
