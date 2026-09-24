/**
 * GraphEdit registration: the native painter and rect solve. Importing
 * `./nativeSolver` registers the container-layout function.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { GraphEdit } from './Component';
import './nativeSolver';

// `wrapsChildren`: `set_clip_contents(true)` (`graph_edit.cpp:3342`) opens a clip scope,
// which reaches the subtree only as React children.
controlComponentRegistry.register({ typeName: 'GraphEdit', Component: GraphEdit, wrapsChildren: true });

export { GraphEdit };
