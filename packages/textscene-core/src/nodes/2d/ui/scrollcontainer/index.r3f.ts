/** ScrollContainer registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ScrollContainer } from './Component';

controlComponentRegistry.register({ typeName: 'ScrollContainer', Component: ScrollContainer });

export { ScrollContainer };
