/** CenterContainer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { CenterContainer } from './Component';

controlComponentRegistry.register({ typeName: 'CenterContainer', Component: CenterContainer });

export { CenterContainer };
