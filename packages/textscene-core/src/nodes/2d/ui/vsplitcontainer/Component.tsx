/**
 * <VSplitContainer> — two children stacked, separated by the dragger's band.
 * The layout is the shared SplitContainer component; this slice supplies only
 * the axis.
 */

import { createSplitContainerComponent } from '../shared/SplitContainerComponent';

export const VSplitContainer = createSplitContainerComponent({
  typeName: 'VSplitContainer',
  vertical: true,
});
