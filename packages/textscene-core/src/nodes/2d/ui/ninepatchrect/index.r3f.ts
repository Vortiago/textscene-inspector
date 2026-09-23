/** Registers the NinePatchRect native painter and rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { NinePatchRect } from './Component';
import { ninePatchRectMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'NinePatchRect', Component: NinePatchRect });
controlSolverRegistry.registerMinimumSize('NinePatchRect', ninePatchRectMinimumSize);

export { NinePatchRect };
