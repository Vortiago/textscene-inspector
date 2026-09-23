/**
 * TextureProgressBar registration: the native (WebGL canvas) painter and rect solver.
 * Importing `./nativeSolver` registers the minimum-size function.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { TextureProgressBar } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'TextureProgressBar', Component: TextureProgressBar });

export { TextureProgressBar };
