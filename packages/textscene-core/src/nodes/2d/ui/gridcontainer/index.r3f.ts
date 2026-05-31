/** GridContainer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { GridContainer } from './Component';

controlComponentRegistry.register({ typeName: 'GridContainer', Component: GridContainer });

export { GridContainer };
