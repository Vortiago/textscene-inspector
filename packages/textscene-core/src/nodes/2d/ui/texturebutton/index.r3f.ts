/** TextureButton registration: native (WebGL canvas) painter and rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { TextureButton } from './Component';
import { textureButtonMinimumSize, textureButtonTextureSlots } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'TextureButton', Component: TextureButton });
controlSolverRegistry.registerMinimumSize('TextureButton', textureButtonMinimumSize);
// Declares `texture_normal`/`texture_pressed`/`texture_hover` for `buildSolveTree.ts`'s
// texture-size resolution (`nativeSolver.ts`).
controlSolverRegistry.registerTextureSlots('TextureButton', textureButtonTextureSlots);

export { TextureButton };
