/**
 * A dialog is the root of its own Control canvas. Its layout fills the content rect with each authored
 * child (`dialogLayout.ts`). Its contents minimum, which `wrap_controls` reads, holds the message and
 * the buttons. `DialogChrome.tsx` paints the panel, the message and the buttons.
 */

import { controlComponentRegistry } from '../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { DialogChrome } from './DialogChrome';
import { dialogContentsMinimumSize, dialogLayout } from './dialogLayout';

/** Registers the dialog's solver hooks and painter for `typeName`: each registry matches one type name exactly. */
export function registerDialogControls(typeName: string): void {
  controlSolverRegistry.registerCanvasBoundary(typeName);
  controlSolverRegistry.registerContainerLayout(typeName, dialogLayout);
  controlSolverRegistry.registerMinimumSize(typeName, dialogContentsMinimumSize);
  controlComponentRegistry.register({ typeName, Component: DialogChrome });
}

registerDialogControls('AcceptDialog');
