/** VBoxContainer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VBoxContainer } from './Component';

controlComponentRegistry.register({ typeName: 'VBoxContainer', Component: VBoxContainer });

export { VBoxContainer };
