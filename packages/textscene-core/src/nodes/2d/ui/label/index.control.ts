/** Label registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Label } from './Component';

controlComponentRegistry.register({ typeName: 'Label', Component: Label });

export { Label };
