/**
 * GraphEdit registration — native (WebGL canvas) painter + rect solve.
 * `./nativeSolver` registers the container-layout function as a side effect
 * of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { GraphEdit } from './Component';
import './nativeSolver';

controlComponentRegistry.register({ typeName: 'GraphEdit', Component: GraphEdit });

export { GraphEdit };
