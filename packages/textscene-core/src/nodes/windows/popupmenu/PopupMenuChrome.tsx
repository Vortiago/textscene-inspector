/**
 * PopupMenu's internal Controls (`popup_menu.cpp:3483-3493`): the panel, then the item control's
 * rows inside the ScrollContainer's clip, then its vertical bar. A still frame has no scroll offset,
 * hover or open submenu, so each row draws as `_draw_items` lays it out (`menuDrawing.ts`).
 */
import { memo, useMemo } from 'react';
import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';
import { canvasSubOrders } from '../../../r3f/canvasItemState';
import { useOwnerCanvas2DTexture } from '../../../r3f/canvas2DTextureDecode';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../r3f/controls/ControlComponentRegistry';
import { tintColor } from '../../../r3f/controls/native/buttonBase';
import {
  ControlClipProvider,
  useControlClipPlanes,
  useWorldClipPlanes,
} from '../../../r3f/controls/native/controlClipping';
import { PositionedIcon } from '../../../r3f/controls/native/PositionedIcon';
import { StyleBoxQuad } from '../../../r3f/controls/native/StyleBoxQuad';
import { OutlinedTextRun, useTintedOutline } from '../../../r3f/controls/native/text/OutlinedTextRun';
import type { CheckBoxIconKey } from '../../2d/ui/checkbox/nativeSolver';
import { useCheckBoxIcon } from '../../2d/ui/checkbox/useCheckBoxIcon';
import { ScrollBarChrome } from '../../2d/ui/shared/ScrollChrome';
import { useTexture2D } from '../../../resources/useTexture2D';
import { useNodeReference } from '../../../resources/reading';
import { popupMenuDrawing, type RowDrawing } from './menuDrawing';
import { menuModel, popupMenuGeometry } from './menuLayout';

type Solved = NativeControlComponentProps['solveNode'];

interface PartProps {
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

function CheckMark({
  iconKey,
  position,
  size,
  solveNode,
  tint,
  renderOrder,
}: PartProps & { iconKey: CheckBoxIconKey; position: Vector2; size: Vector2; solveNode: Solved }) {
  const texture = useCheckBoxIcon(solveNode, iconKey);
  const rect = { x: position.x, y: position.y, w: size.x, h: size.y };
  return (
    <PositionedIcon
      rect={rect}
      texture={texture}
      color={tint.color}
      opacity={tint.opacity}
      renderOrder={renderOrder}
      canvasKey={renderOrder}
    />
  );
}

/** One item icon, a component of its own so its `useTexture2D` call keeps a stable call site. */
function ItemIcon({
  textureRef,
  rect,
  solveNode,
  tint,
  renderOrder,
}: PartProps & { textureRef: string; rect: Rect2; solveNode: Solved }) {
  const { texture: source } = useTexture2D(useNodeReference(textureRef, solveNode.resources));
  const texture = useOwnerCanvas2DTexture(source);
  return (
    <PositionedIcon
      rect={rect}
      texture={texture}
      color={tint.color}
      opacity={tint.opacity}
      renderOrder={renderOrder}
      canvasKey={renderOrder}
    />
  );
}

function RowText({ text, tint, renderOrder }: PartProps & { text: NonNullable<RowDrawing['text']> }) {
  const clippingPlanes = useControlClipPlanes();
  const color = useMemo(() => tintColor(text.color, tint.own), [text.color, tint.own]);
  const outline = useTintedOutline(text.outline, tint.own);
  return (
    <CanvasItemGroup position={[text.position.x, -text.position.y, 0]} renderOrder={renderOrder}>
      <OutlinedTextRun
        layout={text.layout}
        outline={outline}
        fontSizePx={text.fontSizePx}
        tint={color}
        clippingPlanes={clippingPlanes}
        renderOrder={renderOrder}
      />
    </CanvasItemGroup>
  );
}

interface RowProps extends PartProps {
  drawing: RowDrawing;
  /** The item's `icon` property, which names the texture the drawing stretches over its rect. */
  iconRef: string | undefined;
  solveNode: Solved;
}

/** One row: separator lines under the check mark, the icon and the text. */
const RowParts = memo(function RowParts({ drawing, iconRef, solveNode, tint, renderOrder }: RowProps) {
  const part = { tint, renderOrder };
  return (
    <>
      {drawing.separators.map(({ style, rect }, index) => (
        <CanvasItemGroup key={index} position={[rect.x, -rect.y, 0]} renderOrder={renderOrder}>
          <StyleBoxQuad
            styleBox={style}
            color={tint.own}
            rect={{ ...rect, x: 0, y: 0 }}
            renderOrder={renderOrder}
          />
        </CanvasItemGroup>
      ))}
      {drawing.check && (
        <CheckMark
          {...part}
          iconKey={drawing.check.key}
          position={drawing.check.position}
          size={drawing.check.size}
          solveNode={solveNode}
        />
      )}
      {drawing.icon && iconRef !== undefined && (
        <ItemIcon {...part} textureRef={iconRef} rect={drawing.icon.rect} solveNode={solveNode} />
      )}
      {drawing.text && <RowText {...part} text={drawing.text} />}
    </>
  );
});

export function PopupMenuChrome({
  solveNode,
  rect,
  theme,
  tint,
  renderOrder,
  slot,
  measureText,
  snapToPixels,
}: NativeControlComponentProps) {
  const model = useMemo(() => menuModel(solveNode, { theme, measureText }), [solveNode, theme, measureText]);
  const { menu } = model;
  const geometry = useMemo(
    () => popupMenuGeometry(solveNode, { x: rect.w, y: rect.h }, model),
    [solveNode, rect.w, rect.h, model]
  );
  const rows = useMemo(
    () => popupMenuDrawing(solveNode, menu, geometry.rows, geometry.control.w, geometry.scroll.h),
    [solveNode, menu, geometry.rows, geometry.control.w, geometry.scroll.h]
  );
  const { anchorRef, clip } = useWorldClipPlanes(geometry.scroll);
  const orders = canvasSubOrders(slot, ['rows', 'bars']);
  const rowOrder = orders.rows.key;
  const panelRect = useMemo(
    () => ({ x: 0, y: 0, w: geometry.panel.w, h: geometry.panel.h }),
    [geometry.panel.w, geometry.panel.h]
  );

  return (
    <CanvasItemGroup ref={anchorRef}>
      <CanvasItemGroup position={[geometry.panel.x, -geometry.panel.y, 0]}>
        <StyleBoxQuad styleBox={menu.panel} color={tint.own} rect={panelRect} renderOrder={renderOrder} />
      </CanvasItemGroup>
      <ControlClipProvider value={clip}>
        <CanvasItemGroup position={[geometry.control.x, -geometry.control.y, 0]}>
          {rows.map((drawing, index) => {
            const row = geometry.rows[index]!;
            return (
              <RowParts
                key={index}
                drawing={drawing}
                iconRef={row.entry.item.icon}
                solveNode={solveNode}
                tint={tint}
                renderOrder={rowOrder}
              />
            );
          })}
        </CanvasItemGroup>
      </ControlClipProvider>
      <CanvasItemGroup position={[geometry.scroll.x, -geometry.scroll.y, 0]}>
        <ScrollBarChrome
          bar={geometry.verticalBar}
          boxes={menu.scrollBar}
          color={tint.own}
          chromeSlot={orders.bars}
          snapToPixels={snapToPixels}
        />
      </CanvasItemGroup>
    </CanvasItemGroup>
  );
}
