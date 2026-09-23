/**
 * Container registration: the native (WebGL canvas) painter. Container sorts
 * no children and has no minimum size of its own, so it registers no solver.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Container } from './Component';

controlComponentRegistry.register({ typeName: 'Container', Component: Container });

export { Container };
