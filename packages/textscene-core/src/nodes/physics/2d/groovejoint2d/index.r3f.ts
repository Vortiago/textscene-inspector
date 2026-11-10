/**
 * GrooveJoint2D draws its editor marker for every node (ADR-0056). The joint simulation is runtime only
 * (ADR-0005), so the marker has no simulation to follow.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { GrooveJoint2D } from './Component';

nodeComponentRegistry.register({ typeName: 'GrooveJoint2D', Component: GrooveJoint2D, canvasItem: true });
