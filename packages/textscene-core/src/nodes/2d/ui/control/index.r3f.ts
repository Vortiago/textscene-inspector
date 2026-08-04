/** Control registration — native (WebGL canvas) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Control } from './Component';

controlComponentRegistry.register({ typeName: 'Control', Component: Control });

export { Control };
