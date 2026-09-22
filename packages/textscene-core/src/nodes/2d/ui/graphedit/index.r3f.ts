/**
 * GraphEdit registration — native (WebGL canvas) painter + rect solve.
 * `./nativeSolver` registers the container-layout function as a side effect
 * of import.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { GraphEdit } from './Component';
import './nativeSolver';

// `wrapsChildren` — `set_clip_contents(true)` (`graph_edit.cpp:3342`) puts the
// subtree in a new ambient clip scope, which only reaches it as React children.
controlComponentRegistry.register({ typeName: 'GraphEdit', Component: GraphEdit, wrapsChildren: true });

export { GraphEdit };
