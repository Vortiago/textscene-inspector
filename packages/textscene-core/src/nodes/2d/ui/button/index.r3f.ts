/** Button registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Button } from './Component';

controlComponentRegistry.register({ typeName: 'Button', Component: Button });

export { Button };
