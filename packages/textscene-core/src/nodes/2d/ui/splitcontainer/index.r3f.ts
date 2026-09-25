/** SplitContainer registration: native rect solve and painter. Importing `./nativeSolver` registers its solvers. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { SplitContainer } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'SplitContainer', Component: SplitContainer });

export { SplitContainer };
