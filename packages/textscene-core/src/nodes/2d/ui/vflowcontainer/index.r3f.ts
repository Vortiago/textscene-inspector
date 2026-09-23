/**
 * VFlowContainer registration: the native (WebGL canvas) painter and rect solver. Importing
 * `../flowcontainer/nativeSolver` registers the layout and minimum size for all three FlowContainer types.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { VFlowContainer } from './Component';
import '../flowcontainer/nativeSolver';

controlComponentRegistry.register({
  typeName: 'VFlowContainer',
  Component: VFlowContainer,
});

export { VFlowContainer };
