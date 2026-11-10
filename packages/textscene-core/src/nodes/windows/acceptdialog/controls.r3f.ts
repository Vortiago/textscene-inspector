/**
 * AcceptDialog and its subclass ConfirmationDialog as the root of their own Control canvas: a canvas
 * boundary whose layout fills the content rect with each authored child (`dialogLayout.ts`), whose
 * contents minimum, which `wrap_controls` reads, holds the message and the buttons, and which
 * paints its panel, message and buttons (`DialogChrome.tsx`).
 */

import { controlComponentRegistry } from '../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { DialogChrome } from './DialogChrome';
import { dialogContentsMinimumSize, dialogLayout } from './dialogLayout';

for (const typeName of ['AcceptDialog', 'ConfirmationDialog']) {
  controlSolverRegistry.registerCanvasBoundary(typeName);
  controlSolverRegistry.registerContainerLayout(typeName, dialogLayout);
  controlSolverRegistry.registerMinimumSize(typeName, dialogContentsMinimumSize);
  controlComponentRegistry.register({ typeName, Component: DialogChrome });
}
