/** CodeEdit registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { CodeEdit } from './Component';
import { codeEditMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'CodeEdit', Component: CodeEdit });
controlSolverRegistry.registerMinimumSize('CodeEdit', codeEditMinimumSize);
// `CodeEdit::get_minimum_size` is TextEdit's own — see `../textedit/index.r3f.ts`
// for why that needs the second solve pass.
controlSolverRegistry.registerSizeDependentMinimum('CodeEdit');

export { CodeEdit };
