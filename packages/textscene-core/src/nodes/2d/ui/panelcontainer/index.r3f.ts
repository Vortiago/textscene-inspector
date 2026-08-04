/**
 * PanelContainer registration — the native (WebGL canvas) painter, and the
 * native rect solver's minimum-size/container-layout registrations
 * `nativeSolver.ts` exports (`controlSolverRegistry`, not
 * `controlComponentRegistry` — a distinct registry keyed the same way).
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
