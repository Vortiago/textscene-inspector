/**
 * `<MenuButton>`, the native painter. `menu_button.cpp` has no `_notification(NOTIFICATION_DRAW)`, so it
 * paints as `<Button>` does, with the items of its own theme type.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ButtonPainter } from '../button/Component';
import { BUTTON_CLASS } from '../button/nativeSolver';

export function MenuButton(props: NativeControlComponentProps) {
  return <ButtonPainter {...props} buttonClass={BUTTON_CLASS} />;
}
