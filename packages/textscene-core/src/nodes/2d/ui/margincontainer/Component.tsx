/**
 * <MarginContainer> — pads its single child. The four margins come from
 * `theme_override_constants/margin_{left,top,right,bottom}` → CSS padding.
 * Provides the 'margin' layout kind so the child fills the padded box.
 */

import { createContainerComponent } from '../../../../r3f/controls/createContainerComponent';
import type { ControlProperties } from '../control/types';

export const MarginContainer = createContainerComponent<ControlProperties>({
  typeName: 'MarginContainer',
  kind: 'margin',
  useStyle: (props) => {
    const c = props.themeOverrideConstants ?? {};
    return {
      display: 'flex',
      flexDirection: 'column',
      padding: `${c.margin_top ?? 0}px ${c.margin_right ?? 0}px ${c.margin_bottom ?? 0}px ${c.margin_left ?? 0}px`,
    };
  },
});
