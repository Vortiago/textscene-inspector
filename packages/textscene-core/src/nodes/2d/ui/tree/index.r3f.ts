/** Tree registration — native (WebGL canvas) painter. No solver: Tree overrides no `get_minimum_size` (`nativeSolver.ts`'s own doc). */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Tree } from './Component';

controlComponentRegistry.register({ typeName: 'Tree', Component: Tree });

export { Tree };
