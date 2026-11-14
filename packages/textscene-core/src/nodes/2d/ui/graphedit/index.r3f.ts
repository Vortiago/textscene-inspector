/**
 * GraphEdit registration: the native painter, the rect solve and the toolbar its constructor builds.
 * Importing `./nativeSolver` registers the container-layout function.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { registerInternalControls } from '../../../../r3f/controls/native/internalControls';
import { GraphEdit } from './Component';
import {
  graphEditInternalControls,
  graphEditInternalLayout,
  graphEditTextureSlots,
  graphEditTopLayerSlots,
} from './internalControls';
import './nativeSolver';

controlSolverRegistry.registerTextureSlots('GraphEdit', graphEditTextureSlots);
registerInternalControls(
  'GraphEdit',
  graphEditInternalControls,
  graphEditInternalLayout,
  (backSlot) => graphEditTopLayerSlots(backSlot).toolbar
);

// `wrapsChildren`: `set_clip_contents(true)` (`graph_edit.cpp:3342`) opens a clip scope,
// which reaches the subtree only as React children.
controlComponentRegistry.register({ typeName: 'GraphEdit', Component: GraphEdit, wrapsChildren: true });
