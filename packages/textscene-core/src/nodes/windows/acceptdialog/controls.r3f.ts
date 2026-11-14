/**
 * A dialog is the root of its own Control canvas. Its layout fills the content rect with each authored
 * child (`dialogLayout.ts`). Its contents minimum, which `wrap_controls` reads, holds the message and
 * the buttons. Its internal Controls are the message, the class's body and the button row
 * (`dialogParts.ts`). `DialogChrome.tsx` paints the panel.
 */

import { registerWindowControls } from '../window/registerWindowControls.r3f';
import { controlSolverRegistry, type TextureSlotsFn } from '../../../r3f/controls/native/solverRegistry';
import { registerInternalControls } from '../../../r3f/controls/native/internalControls';
import { DialogChrome } from './DialogChrome';
import {
  dialogContentsMinimumSize,
  dialogInternalLayout,
  dialogLayout,
  dialogLoadedMinimumSize,
} from './dialogLayout';
import { dialogInternalControls, dialogTextureSlots } from './dialogParts';

/**
 * Registers the dialog's solver hooks, internal Controls and painter for `typeName`: each registry matches
 * one type name exactly. `textureSlots` replaces the slots of the OK and Cancel buttons for a dialog that adds its own.
 */
export function registerDialogControls(
  typeName: string,
  textureSlots: TextureSlotsFn = dialogTextureSlots
): void {
  controlSolverRegistry.registerTextureSlots(typeName, textureSlots);
  registerInternalControls(typeName, dialogInternalControls, dialogInternalLayout);
  registerWindowControls({
    typeName,
    Component: DialogChrome,
    minimumSize: dialogContentsMinimumSize,
    layout: dialogLayout,
    loadedMinimumSize: dialogLoadedMinimumSize,
  });
}

registerDialogControls('AcceptDialog');
