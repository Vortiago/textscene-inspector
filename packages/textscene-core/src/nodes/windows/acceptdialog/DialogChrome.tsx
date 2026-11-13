/**
 * AcceptDialog's internal Controls (`dialogs.cpp:472-497`): the background panel and the message
 * under every authored Control, then the button row over them. The panel and the label are
 * `INTERNAL_MODE_FRONT` children and the row is `INTERNAL_MODE_BACK`, so the row draws from the chrome slot.
 */
import { useMemo, type ComponentType } from 'react';
import type { Rect2 } from '../../../godot/math/rect2';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import { canvasPieceSlot } from '../../../r3f/canvasItemState';
import {
  controlComponentRegistry,
  type NativeControlComponentProps,
} from '../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { createSolveContext } from '../../../r3f/controls/native/controlRectSolver';
import { StyleBoxQuad } from '../../../r3f/controls/native/StyleBoxQuad';
import { Button } from '../../2d/ui/button/Component';
import { Label } from '../../2d/ui/label/Component';
import { dialogButtonNode, dialogPanelBox, messageLabelNode } from './dialogParts';
import { dialogGeometry } from './dialogLayout';

const EMPTY_CHILD_RECTS: NativeControlComponentProps['childRects'] = new Map();

export function DialogChrome(props: NativeControlComponentProps) {
  const { solveNode, rect, theme, tint, renderOrder, slot, chromeSlot, measureText } = props;
  // A context memoises minimum sizes by path, so each dialog node gets a fresh one: its text may differ from the last.
  const geometry = useMemo(
    () => dialogGeometry(solveNode, { x: rect.w, y: rect.h }, createSolveContext(theme, measureText)),
    [solveNode, rect.w, rect.h, theme, measureText]
  );
  const label = useMemo(() => messageLabelNode(solveNode), [solveNode]);
  const buttons = useMemo(
    () =>
      geometry.buttons.map((button) => ({
        ...button,
        node: dialogButtonNode(solveNode, button.role),
      })),
    [geometry, solveNode]
  );
  const panelBox = useMemo(() => dialogPanelBox(solveNode), [solveNode]);
  const panelRect = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  // The label is piece 0 and the body Controls follow in tree order, so the body draws over it.
  const drawnBody = useMemo(() => {
    const painted = geometry.body.flatMap(({ control, rect: at }) => {
      const Painter = controlComponentRegistry.get(control.node.type);
      return Painter ? [{ control, at, Painter }] : [];
    });
    return painted.map((part, index) => ({
      ...part,
      slot: canvasPieceSlot(slot, 1 + index, 1 + painted.length),
    }));
  }, [geometry, slot]);
  const pieceCount = 1 + drawnBody.length;
  const labelSlot = canvasPieceSlot(slot, 0, pieceCount);
  const buttonsSlot = canvasPieceSlot(chromeSlot, 0, 1);

  // A synthetic Control draws from its own group, as any Control the walker places does.
  const drawControl = (
    control: SolveNode,
    at: Rect2,
    controlSlot: typeof slot,
    Painter: ComponentType<NativeControlComponentProps>
  ) => (
    <CanvasItemGroup key={control.path} position={[at.x, -at.y, 0]} renderOrder={controlSlot.key}>
      <Painter
        {...props}
        solveNode={control}
        rect={{ x: 0, y: 0, w: at.w, h: at.h }}
        renderOrder={controlSlot.key}
        slot={controlSlot}
        chromeSlot={controlSlot}
        layerSlot={controlSlot}
        childRects={EMPTY_CHILD_RECTS}
        meta={undefined}
      />
    </CanvasItemGroup>
  );

  return (
    <>
      <StyleBoxQuad styleBox={panelBox} color={tint.own} rect={panelRect} renderOrder={renderOrder} />
      {drawControl(label, geometry.content, labelSlot, Label)}
      {drawnBody.map(({ control, at, Painter, slot: bodySlot }) =>
        drawControl(control, at, bodySlot, Painter)
      )}
      {buttons.map((button) => drawControl(button.node, button.rect, buttonsSlot, Button))}
    </>
  );
}
