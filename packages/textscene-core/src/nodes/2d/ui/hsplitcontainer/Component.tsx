/**
 * <HSplitContainer> — two children side by side, separated by the dragger's
 * band. The layout is the shared SplitContainer component; this slice supplies
 * only the axis.
 */

import { createSplitContainerComponent } from '../shared/SplitContainerComponent';

export const HSplitContainer = createSplitContainerComponent({
  typeName: 'HSplitContainer',
  vertical: false,
});
