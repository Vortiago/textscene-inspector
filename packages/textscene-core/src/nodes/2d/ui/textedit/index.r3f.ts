/** TextEdit registration: native (WebGL canvas) painter and rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { TextEdit } from './Component';
import { textEditMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'TextEdit', Component: TextEdit });
controlSolverRegistry.registerMinimumSize('TextEdit', textEditMinimumSize);
// `scroll_fit_content_height` under `wrap_mode` BOUNDARY needs this node's resolved width
// to count its wrapped rows (`nativeSolver.ts`, `solverRegistry.ts`'s `tentativeRect`).
controlSolverRegistry.registerSizeDependentMinimum('TextEdit');

export { TextEdit };
