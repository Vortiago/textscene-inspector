/** Panel registration — native (WebGL canvas) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Panel } from './Component';

controlComponentRegistry.register({ typeName: 'Panel', Component: Panel });

export { Panel };
