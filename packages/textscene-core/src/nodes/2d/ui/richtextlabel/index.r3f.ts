/** RichTextLabel registration — native (WebGL canvas) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { RichTextLabel } from './Component';
import { richTextLabelMinimumSize } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'RichTextLabel',
  Component: RichTextLabel,
});
controlSolverRegistry.registerMinimumSize('RichTextLabel', richTextLabelMinimumSize);
// With `fit_content` and autowrap ON the minimum HEIGHT is the text wrapped at
// this control's own width, which only a completed pass knows — read through
// `SolveContext.tentativeRect`, exactly as Label does.
controlSolverRegistry.registerSizeDependentMinimum('RichTextLabel');

export { RichTextLabel };
