/** ColorRect registration — native (WebGL canvas) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ColorRect } from './Component';

controlComponentRegistry.register({ typeName: 'ColorRect', Component: ColorRect });

export { ColorRect };
