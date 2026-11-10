/** FileDialog draws as a ConfirmationDialog with the Controls its constructor builds above the buttons (`body.ts`). */

import { registerDialogControls } from '../acceptdialog/controls.r3f';
import { registerDialogBody } from '../acceptdialog/dialogParts';
import { controlSolverRegistry } from '../../../r3f/controls/native/solverRegistry';
import { fileDialogBody, fileDialogTextureSlots } from './body';

registerDialogControls('FileDialog');
registerDialogBody('FileDialog', fileDialogBody);
controlSolverRegistry.registerTextureSlots('FileDialog', fileDialogTextureSlots);
