/** MarginContainer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { MarginContainer } from './Component';

controlComponentRegistry.register({ typeName: 'MarginContainer', Component: MarginContainer });

export { MarginContainer };
