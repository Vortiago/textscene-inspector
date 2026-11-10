/** GrooveJoint2D draws its editor marker for every node (ADR-0056). */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { GrooveJoint2D } from './Component';

nodeComponentRegistry.register({ typeName: 'GrooveJoint2D', Component: GrooveJoint2D, canvasItem: true });
