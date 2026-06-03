/**
 * <ScrollContainer> — clips its content and scrolls when it overflows
 * (CSS `overflow: auto`). Provides the 'block' layout kind so its single child
 * flows at its natural size and scrolls within the container's rect.
 */

import { createContainerComponent } from '../../../../r3f/controls/createContainerComponent';
import type { ControlProperties } from '../control/types';

export const ScrollContainer = createContainerComponent<ControlProperties>({
  typeName: 'ScrollContainer',
  kind: 'block',
  useStyle: () => ({ overflow: 'auto' }),
});
