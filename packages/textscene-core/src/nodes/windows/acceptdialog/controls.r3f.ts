/**
 * A dialog is the root of its own Control canvas. Its layout fills the content rect with each authored
 * child (`dialogLayout.ts`). Its contents minimum, which `wrap_controls` reads, holds the message and
 * the buttons. `DialogChrome.tsx` paints the panel, the message and the buttons.
 */

import { registerWindowControls } from '../window/registerWindowControls.r3f';
import { DialogChrome } from './DialogChrome';
import { dialogContentsMinimumSize, dialogLayout } from './dialogLayout';

/** Registers the dialog's solver hooks and painter for `typeName`: each registry matches one type name exactly. */
export function registerDialogControls(typeName: string): void {
  registerWindowControls({
    typeName,
    Component: DialogChrome,
    minimumSize: dialogContentsMinimumSize,
    layout: dialogLayout,
  });
}

registerDialogControls('AcceptDialog');
