/** CanvasLayer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { CanvasLayer } from './Component';

controlComponentRegistry.register({ typeName: 'CanvasLayer', Component: CanvasLayer });

export { CanvasLayer };
