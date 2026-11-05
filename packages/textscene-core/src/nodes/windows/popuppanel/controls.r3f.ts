/**
 * PopupPanel as the root of its own Control canvas: a canvas boundary whose layout fills its panel
 * with each child (`contentLayout.ts`), painted with the panel under them.
 */

import { controlComponentRegistry } from '../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { popupPanelContentsMinimumSize, popupPanelLayout } from './contentLayout';
import { PopupPanelChrome } from './PopupPanelChrome';

controlSolverRegistry.registerCanvasBoundary('PopupPanel');
controlSolverRegistry.registerContainerLayout('PopupPanel', popupPanelLayout);
// Its contents minimum, which `wrap_controls` reads: the window root's own rect never floors at it.
controlSolverRegistry.registerMinimumSize('PopupPanel', popupPanelContentsMinimumSize);
controlComponentRegistry.register({ typeName: 'PopupPanel', Component: PopupPanelChrome });
