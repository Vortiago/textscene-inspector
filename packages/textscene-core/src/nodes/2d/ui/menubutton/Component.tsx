/**
 * `<MenuButton>`, the native painter. `menu_button.cpp` has no `_notification(NOTIFICATION_DRAW)`, so it
 * paints as `<Button>` does, with MenuButton's own `font_disabled_color` (`nativeSolver.ts`).
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ButtonPainter } from '../button/Component';
import { MENU_BUTTON_CLASS } from './nativeSolver';

export function MenuButton(props: NativeControlComponentProps) {
  return <ButtonPainter {...props} buttonClass={MENU_BUTTON_CLASS} />;
}
