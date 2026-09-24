/** Registers the native (WebGL canvas) painter and solvers for RichTextLabel. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { RichTextLabel } from './Component';
import { richTextLabelMinimumSize, richTextLabelTextureSlots } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'RichTextLabel',
  Component: RichTextLabel,
});
controlSolverRegistry.registerMinimumSize('RichTextLabel', richTextLabelMinimumSize);
// Declares every `[img]` ref whose natural pixel size this node's BBCode needs.
controlSolverRegistry.registerTextureSlots('RichTextLabel', richTextLabelTextureSlots);
// With `fit_content` and autowrap on, the minimum height is the text wrapped at
// this control's width, which only a completed pass knows: it reads
// `SolveContext.tentativeRect`, as Label does.
controlSolverRegistry.registerSizeDependentMinimum('RichTextLabel');

export { RichTextLabel };
