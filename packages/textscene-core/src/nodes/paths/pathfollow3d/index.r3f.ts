/** PathFollow3D follows the parent Path3D's curve, drawing a handle while selected (ADR-0056). */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { PathFollow3D } from './Component';

nodeComponentRegistry.register({ typeName: 'PathFollow3D', Component: PathFollow3D });
