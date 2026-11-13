/**
 * A dialog is the root of its own Control canvas. Its layout fills the content rect with each authored
 * child (`dialogLayout.ts`). Its contents minimum, which `wrap_controls` reads, holds the message and
 * the buttons. `DialogChrome.tsx` paints the panel, the message and the buttons.
 */

import { registerWindowControls } from '../window/registerWindowControls.r3f';
import { controlSolverRegistry, type TextureSlotsFn } from '../../../r3f/controls/native/solverRegistry';
import { DialogChrome } from './DialogChrome';
import { dialogContentsMinimumSize, dialogLayout } from './dialogLayout';
import { dialogTextureSlots } from './dialogParts';

/**
 * Registers the dialog's solver hooks and painter for `typeName`: each registry matches one type name exactly.
 * `textureSlots` replaces the slots of the OK and Cancel buttons for a dialog that adds its own.
 */
export function registerDialogControls(
  typeName: string,
  textureSlots: TextureSlotsFn = dialogTextureSlots
): void {
  controlSolverRegistry.registerTextureSlots(typeName, textureSlots);
  registerWindowControls({
    typeName,
    Component: DialogChrome,
    minimumSize: dialogContentsMinimumSize,
    layout: dialogLayout,
  });
}

registerDialogControls('AcceptDialog');
