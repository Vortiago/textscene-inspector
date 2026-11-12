/** FileDialog draws as a ConfirmationDialog with the Controls its constructor builds above the buttons (`body.ts`). */

import { registerDialogControls } from '../acceptdialog/controls.r3f';
import { registerDialogBody } from '../acceptdialog/dialogParts';
import { fileDialogBody, fileDialogTextureSlots } from './body';

registerDialogControls('FileDialog', fileDialogTextureSlots);
registerDialogBody('FileDialog', fileDialogBody);
