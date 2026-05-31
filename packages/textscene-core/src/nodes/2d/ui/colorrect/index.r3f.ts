/** ColorRect registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ColorRect } from './Component';

controlComponentRegistry.register({ typeName: 'ColorRect', Component: ColorRect });

export { ColorRect };
