/** HBoxContainer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { HBoxContainer } from './Component';

controlComponentRegistry.register({ typeName: 'HBoxContainer', Component: HBoxContainer });

export { HBoxContainer };
