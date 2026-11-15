/** FileDialog draws as a ConfirmationDialog with the Controls its constructor builds above the buttons (`body.ts`). */

import { registerDialogControls } from '../acceptdialog/controls.r3f';
import { registerDialogBody } from '../acceptdialog/dialogParts';
import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { fileDialogBody, fileDialogTextureSlots } from './body';
import { fileDialogFolders, resolveFileDialog } from './resolve';

registerDialogControls('FileDialog', fileDialogTextureSlots);
registerDialogBody('FileDialog', fileDialogBody);
controlSolverRegistry.registerDirectoryResolver('FileDialog', {
  folders: fileDialogFolders,
  resolve: resolveFileDialog,
});
