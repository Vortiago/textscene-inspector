/**
 * Registers the native (WebGL canvas) painter for PanelContainer, and its
 * minimum-size and container-layout solvers in `controlSolverRegistry`.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { PanelContainer } from './Component';
import { panelContainerLayout, panelContainerMinimumSize } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'PanelContainer',
  Component: PanelContainer,
});
controlSolverRegistry.registerMinimumSize('PanelContainer', panelContainerMinimumSize);
controlSolverRegistry.registerContainerLayout('PanelContainer', panelContainerLayout);

export { PanelContainer };
