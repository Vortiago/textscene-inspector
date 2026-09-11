/**
 * TextureProgressBar registration — the native (WebGL canvas) rect solve +
 * painter. `./nativeSolver` registers the minimum-size function as a side
 * effect of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { TextureProgressBar } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'TextureProgressBar', Component: TextureProgressBar });

export { TextureProgressBar };
