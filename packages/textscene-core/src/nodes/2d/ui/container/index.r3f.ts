/**
 * Container registration — the native (WebGL canvas) painter. No solver:
 * Container registers neither a minimum size nor a container layout, since
 * absence is the correct port (this slice's `Component.tsx` module doc).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Container } from './Component';

controlComponentRegistry.register({ typeName: 'Container', Component: Container });

export { Container };
