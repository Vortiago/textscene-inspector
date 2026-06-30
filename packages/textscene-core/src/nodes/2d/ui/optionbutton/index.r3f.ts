/** OptionButton registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { OptionButton } from './Component';

controlComponentRegistry.register({ typeName: 'OptionButton', Component: OptionButton });

export { OptionButton };
