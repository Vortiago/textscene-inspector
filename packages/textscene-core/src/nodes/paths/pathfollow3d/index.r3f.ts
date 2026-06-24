/** PathFollow3D follows the parent Path3D's curve, drawing a selection-gated handle (ADR-0018). */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { PathFollow3D } from './Component';

nodeComponentRegistry.register({ typeName: 'PathFollow3D', Component: PathFollow3D });

export { PathFollow3D };
