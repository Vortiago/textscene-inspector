/** TextEdit registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { TextEdit } from './Component';
import { textEditMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'TextEdit', Component: TextEdit });
controlSolverRegistry.registerMinimumSize('TextEdit', textEditMinimumSize);
// `scroll_fit_content_height` at `wrap_mode` BOUNDARY needs this node's OWN
// resolved width to know how many rows its wrapped text occupies — see
// `nativeSolver.ts`'s own doc and `solverRegistry.ts`'s `tentativeRect`.
controlSolverRegistry.registerSizeDependentMinimum('TextEdit');

export { TextEdit };
