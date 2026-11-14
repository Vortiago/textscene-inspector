/**
 * AcceptDialog's own pixels: `bg_panel`, the `INTERNAL_MODE_FRONT` Panel that fills the dialog with
 * the dialog's `panel` box (`dialogs.cpp:94,225-226,475-476`). The walker paints the message, the
 * body and the button row as internal Controls (`dialogParts.ts`).
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../r3f/controls/ControlComponentRegistry';
import { StyleBoxQuad } from '../../../r3f/controls/native/StyleBoxQuad';
import { dialogPanelBox } from './dialogParts';

export function DialogChrome({ solveNode, rect, tint, renderOrder }: NativeControlComponentProps) {
  const panelBox = useMemo(() => dialogPanelBox(solveNode), [solveNode]);
  const panelRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  return <StyleBoxQuad styleBox={panelBox} color={tint.own} rect={panelRect} renderOrder={renderOrder} />;
}
