/**
 * VFlowContainer registration — the native (WebGL canvas) rect solve +
 * painter. `../flowcontainer/nativeSolver` registers the container-layout/
 * minimum-size functions for all three FlowContainer types as a side effect
 * of import — see its own doc.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VFlowContainer } from './Component';
import '../flowcontainer/nativeSolver';

controlComponentRegistry.register({
  typeName: 'VFlowContainer',
  Component: VFlowContainer,
});

export { VFlowContainer };
