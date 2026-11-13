/** ItemList registration: native (WebGL canvas) painter + rect solver. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import './nativeSolver';
import { ItemList } from './Component';

// `wrapsChildren`: `set_clip_contents(true)` (`item_list.cpp:2482`) opens a clip scope, which reaches
// the subtree only as React children.
controlComponentRegistry.register({ typeName: 'ItemList', Component: ItemList, wrapsChildren: true });
