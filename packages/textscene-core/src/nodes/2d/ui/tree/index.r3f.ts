/** Tree registration: the native (WebGL canvas) painter. No solver, since Tree overrides no `get_minimum_size` (`nativeSolver.ts`). */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Tree } from './Component';

controlComponentRegistry.register({ typeName: 'Tree', Component: Tree });

export { Tree };
