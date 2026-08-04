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

export { RichTextLabel };
