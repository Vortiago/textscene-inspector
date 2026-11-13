/**
 * Window and Popup as the root of their own Control canvas: a canvas boundary, so their Controls
 * anchor against the window's viewport, and an empty painter, as neither draws on its canvas.
 */

import { controlComponentRegistry } from '../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { Control } from '../../2d/ui/control/Component';

for (const typeName of ['Window', 'Popup']) {
  controlSolverRegistry.registerCanvasBoundary(typeName);
  controlComponentRegistry.register({ typeName, Component: Control });
}
