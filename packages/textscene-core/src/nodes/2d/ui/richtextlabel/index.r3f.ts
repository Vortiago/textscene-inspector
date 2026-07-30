/** RichTextLabel registration — 2D-overlay DOM component + native (WebGL canvas) painter. */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { RichTextLabel } from './Component';
import { RichTextLabelNative } from './NativeComponent';
import { richTextLabelMinimumSize } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'RichTextLabel',
  Component: RichTextLabel,
  Native: RichTextLabelNative,
});
controlSolverRegistry.registerMinimumSize('RichTextLabel', richTextLabelMinimumSize);

export { RichTextLabel, RichTextLabelNative };
