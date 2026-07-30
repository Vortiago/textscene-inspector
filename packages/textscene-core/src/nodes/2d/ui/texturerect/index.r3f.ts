/** TextureRect registration — 2D-overlay DOM component + native (WebGL) painter/solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { TextureRect } from './Component';
import { TextureRectNative } from './NativeComponent';
import { textureRectMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'TextureRect', Component: TextureRect, Native: TextureRectNative });
controlSolverRegistry.registerMinimumSize('TextureRect', textureRectMinimumSize);

export { TextureRect, TextureRectNative };
