/** RichTextLabel registration — native (WebGL canvas) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { RichTextLabel } from './Component';
import { richTextLabelMinimumSize, richTextLabelTextureSlots } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'RichTextLabel',
  Component: RichTextLabel,
});
controlSolverRegistry.registerMinimumSize('RichTextLabel', richTextLabelMinimumSize);
// Declares every `[img]` ref THIS node's own BBCode needs the natural pixel
// size of — see `nativeSolver.ts`'s `richTextLabelTextureSlots` doc.
controlSolverRegistry.registerTextureSlots('RichTextLabel', richTextLabelTextureSlots);
// With `fit_content` and autowrap ON the minimum HEIGHT is the text wrapped at
// this control's own width, which only a completed pass knows — read through
// `SolveContext.tentativeRect`, exactly as Label does.
controlSolverRegistry.registerSizeDependentMinimum('RichTextLabel');

export { RichTextLabel };
