/**
 * GraphNode registration: native (WebGL canvas) painter + rect solve.
 * `./nativeSolver` registers the container-layout/minimum-size functions as a
 * side effect of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { GraphNode } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'GraphNode', Component: GraphNode });

export { GraphNode };
