/**
 * PopupPanel as the root of its own Control canvas: a canvas boundary whose layout fills its panel
 * with each child (`contentLayout.ts`), painted with the panel under them.
 */

import { controlComponentRegistry } from '../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { popupPanelLayout } from './contentLayout';
import { PopupPanelChrome } from './PopupPanelChrome';

controlSolverRegistry.registerCanvasBoundary('PopupPanel');
controlSolverRegistry.registerContainerLayout('PopupPanel', popupPanelLayout);
controlComponentRegistry.register({ typeName: 'PopupPanel', Component: PopupPanelChrome });
