/** Registers the native (WebGL canvas) painter for Panel. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Panel } from './Component';

controlComponentRegistry.register({ typeName: 'Panel', Component: Panel });

export { Panel };
