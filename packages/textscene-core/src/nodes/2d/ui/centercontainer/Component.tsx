/**
 * <CenterContainer> — centers its single child both horizontally and vertically
 * (CSS flex with centered main + cross axis). Provides the 'center' layout kind
 * to its subtree so the child positions itself relative to the centered box.
 */

import { createContainerComponent } from '../../../../r3f/controls/createContainerComponent';
import type { ControlProperties } from '../control/types';

export const CenterContainer = createContainerComponent<ControlProperties>({
  typeName: 'CenterContainer',
  kind: 'center',
  useStyle: () => ({ display: 'flex', alignItems: 'center', justifyContent: 'center' }),
});
