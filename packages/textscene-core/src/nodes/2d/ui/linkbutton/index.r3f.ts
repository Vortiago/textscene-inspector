/** LinkButton registration — native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { LinkButton } from './Component';
import { linkButtonMinimumSize } from './nativeSolver';

controlComponentRegistry.register({ typeName: 'LinkButton', Component: LinkButton });
controlSolverRegistry.registerMinimumSize('LinkButton', linkButtonMinimumSize);

export { LinkButton };
