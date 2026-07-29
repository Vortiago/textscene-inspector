/** HSplitContainer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { HSplitContainer } from './Component';

controlComponentRegistry.register({ typeName: 'HSplitContainer', Component: HSplitContainer });

export { HSplitContainer };
