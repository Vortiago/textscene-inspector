/** VSplitContainer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VSplitContainer } from './Component';

controlComponentRegistry.register({ typeName: 'VSplitContainer', Component: VSplitContainer });

export { VSplitContainer };
