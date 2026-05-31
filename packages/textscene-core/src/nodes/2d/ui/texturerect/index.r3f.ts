/** TextureRect registration — 2D-overlay DOM component. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { TextureRect } from './Component';

controlComponentRegistry.register({ typeName: 'TextureRect', Component: TextureRect });

export { TextureRect };
