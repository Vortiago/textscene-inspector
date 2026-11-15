/**
 * PopupPanel's internal Panel (`popup.cpp:431-436`): the `panel` StyleBox across the window, less
 * the room its shadow takes. It is an internal front child, so it draws under every other Control.
 */
import type { NativeControlComponentProps } from '../../../r3f/controls/ControlComponentRegistry';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import { StyleBoxQuad } from '../../../r3f/controls/native/StyleBoxQuad';
import { panelRect } from '../window/panelInsets';
import { popupPanelBox } from './contentLayout';

export function PopupPanelChrome({ solveNode, rect, tint, renderOrder }: NativeControlComponentProps) {
  const { style, insets } = popupPanelBox(solveNode);
  const panel = panelRect(insets, solveNode.rtl, { x: rect.w, y: rect.h });
  // `StyleBoxQuad` draws from its group's origin, so the group carries the inset.
  return (
    <CanvasItemGroup position={[panel.x, -panel.y, 0]}>
      <StyleBoxQuad
        styleBox={style}
        color={tint.own}
        rect={{ x: 0, y: 0, w: panel.w, h: panel.h }}
        renderOrder={renderOrder}
      />
    </CanvasItemGroup>
  );
}
