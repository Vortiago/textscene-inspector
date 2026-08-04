/** TextureRect registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { TextureRect } from './Component';
import { textureRectMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'TextureRect', Component: TextureRect });
controlSolverRegistry.registerMinimumSize('TextureRect', textureRectMinimumSize);

export { TextureRect };
