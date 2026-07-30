/** LineEdit registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { LineEdit } from './Component';

controlComponentRegistry.register({ typeName: 'LineEdit', Component: LineEdit });

export { LineEdit };
