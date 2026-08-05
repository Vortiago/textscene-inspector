/** TextureRect registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { TextureRect } from './Component';
import { textureRectMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'TextureRect', Component: TextureRect });
controlSolverRegistry.registerMinimumSize('TextureRect', textureRectMinimumSize);
// FIT_WIDTH/FIT_HEIGHT read `SolveContext.tentativeRect` — see
// `nativeSolver.ts`'s own doc and `solverRegistry.ts`'s `tentativeRect`.
controlSolverRegistry.registerSizeDependentMinimum('TextureRect');

export { TextureRect };
