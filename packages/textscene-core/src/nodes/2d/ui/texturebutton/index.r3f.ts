/** TextureButton registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { TextureButton } from './Component';
import { textureButtonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'TextureButton', Component: TextureButton });
controlSolverRegistry.registerMinimumSize('TextureButton', textureButtonMinimumSize);

export { TextureButton };
