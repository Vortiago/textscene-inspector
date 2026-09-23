/**
 * GraphElement registration: native (WebGL canvas) painter + rect solve.
 * `./nativeSolver` registers the container-layout/minimum-size functions as a
 * side effect of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { GraphElement } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'GraphElement', Component: GraphElement });

export { GraphElement };
