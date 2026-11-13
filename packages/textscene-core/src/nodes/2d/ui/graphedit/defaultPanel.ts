/** The `panel` box of a GraphEdit in Godot's default theme. */
import { DEFAULT_CORNER_RADIUS } from '../../../../godot/scene/theme';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  flatCornerDetail,
  flatStyleBox,
  type StyleBoxFlatData,
} from '../../../../r3f/controls/native/styleBoxFlat';

/** `default_theme.cpp:1287`: `make_flat_stylebox(style_normal_color, 4, 4, 4, 5)`, with a larger bottom margin. */
export function graphEditDefaultPanel(theme: NativeTheme): StyleBoxFlatData {
  const { scale } = theme;
  return flatStyleBox(theme.styleFill.normal, {
    contentMargin: {
      left: Math.round(4 * scale),
      top: Math.round(4 * scale),
      right: Math.round(4 * scale),
      bottom: Math.round(5 * scale),
    },
    cornerRadius: theme.cornerRadius,
    cornerDetail: flatCornerDetail(DEFAULT_CORNER_RADIUS, scale),
  });
}
