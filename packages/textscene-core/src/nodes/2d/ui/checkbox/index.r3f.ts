/** CheckBox registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { CheckBox } from './Component';

controlComponentRegistry.register({ typeName: 'CheckBox', Component: CheckBox });

export { CheckBox };
