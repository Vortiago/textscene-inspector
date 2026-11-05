/**
 * PopupPanel's internal Panel (`popup.cpp:431-436`): the `panel` StyleBox across the window, less
 * the room its shadow takes. It is an internal front child, so it draws under every other Control.
 */
import type { NativeControlComponentProps } from '../../../r3f/controls/ControlComponentRegistry';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import { StyleBoxQuad } from '../../../r3f/controls/native/StyleBoxQuad';
import { popupPanelBox } from './contentLayout';

export function PopupPanelChrome({ solveNode, rect, theme, tint, renderOrder }: NativeControlComponentProps) {
  const { style, insets } = popupPanelBox(solveNode, theme);
  const panelSize = {
    x: 0,
    y: 0,
    w: rect.w - insets.left + insets.right,
    h: rect.h - insets.top + insets.bottom,
  };
  // A right-to-left layout mirrors the internal Panel's rect (`control.cpp:1785-1787`).
  const panelX = solveNode.rtl ? -insets.right : insets.left;
  // `StyleBoxQuad` draws from its group's origin, so the group carries the inset.
  return (
    <CanvasItemGroup position={[panelX, -insets.top, 0]}>
      <StyleBoxQuad styleBox={style} color={tint.own} rect={panelSize} renderOrder={renderOrder} />
    </CanvasItemGroup>
  );
}
