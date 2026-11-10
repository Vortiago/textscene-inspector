/**
 * PopupMenu's internal Controls (`popup_menu.cpp:3483-3493`): the panel, then the item control's
 * rows inside the ScrollContainer's clip, then its vertical bar. A still frame has no scroll offset,
 * hover or open submenu, so each row draws as `_draw_items` lays it out (`menuDrawing.ts`).
 */
import { useMemo } from 'react';
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
import { ControlQuad } from '../../../r3f/controls/native/controlQuad';
import { StyleBoxQuad } from '../../../r3f/controls/native/StyleBoxQuad';
import { CHECK_BOX_ICONS } from '../../../r3f/controls/native/themeIcons';
import { OutlinedTextRun } from '../../../r3f/controls/native/text/OutlinedTextRun';
import { useNodeIcon } from '../../../r3f/controls/native/useIconTexture';
import { CHECK_BOX_ICON_THEME_NAME } from '../../2d/ui/checkbox/nativeSolver';
import { ScrollBarChrome } from '../../2d/ui/shared/ScrollChrome';
import { useTexture2D } from '../../../resources/useTexture2D';
import { checkIconSize, type CheckIconKey } from './menuItems';
import { popupMenuDrawing, type RowDrawing } from './menuDrawing';
import { menuModel, popupMenuGeometry } from './menuLayout';

/** `font_outline_size` is 0 in the default theme; the text outline is not drawn here. */
const NO_OUTLINE = { sizePx: 0, color: { r: 0, g: 0, b: 0, a: 0 } };

type Solved = NativeControlComponentProps['solveNode'];

interface PartProps {
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

function CheckMark({
  iconKey,
  position,
  solveNode,
  tint,
  renderOrder,
}: PartProps & { iconKey: CheckIconKey; position: Vector2; solveNode: Solved }) {
  const texture = useNodeIcon(solveNode.icons[CHECK_BOX_ICON_THEME_NAME[iconKey]], CHECK_BOX_ICONS[iconKey]);
  const size = checkIconSize(solveNode, iconKey);
  return (
    <CanvasItemGroup position={[position.x, -position.y, 0]}>
      <ControlQuad
        renderOrder={renderOrder}
        width={size.x}
        height={size.y}
        color={tint.color}
        opacity={tint.opacity}
        map={texture}
      />
    </CanvasItemGroup>
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
  const { externalResources, internalResources } = solveNode.resources;
  const { texture: source } = useTexture2D(textureRef, externalResources, internalResources);
  const texture = useOwnerCanvas2DTexture(source);
  return (
    <CanvasItemGroup position={[rect.x, -rect.y, 0]}>
      <ControlQuad
        renderOrder={renderOrder}
        width={rect.w}
        height={rect.h}
        color={tint.color}
        opacity={tint.opacity}
        map={texture}
      />
    </CanvasItemGroup>
  );
}

function RowText({
  text,
  fontSizePx,
  tint,
  renderOrder,
}: PartProps & { text: NonNullable<RowDrawing['text']>; fontSizePx: number }) {
  const clippingPlanes = useControlClipPlanes();
  const color = useMemo(() => tintColor(text.color, tint.own), [text.color, tint.own]);
  return (
    <CanvasItemGroup position={[text.position.x, -text.position.y, 0]}>
      <OutlinedTextRun
        layout={text.layout}
        outline={NO_OUTLINE}
        fontSizePx={fontSizePx}
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
  fontSizePx: number;
  solveNode: Solved;
}

/** One row: separator lines under the check mark, the icon and the text. */
function RowParts({ drawing, iconRef, fontSizePx, solveNode, tint, renderOrder }: RowProps) {
  const part = { tint, renderOrder };
  return (
    <>
      {drawing.separators.map(({ style, rect }, index) => (
        <CanvasItemGroup key={index} position={[rect.x, -rect.y, 0]}>
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
          solveNode={solveNode}
        />
      )}
      {drawing.icon && iconRef !== undefined && (
        <ItemIcon {...part} textureRef={iconRef} rect={drawing.icon.rect} solveNode={solveNode} />
      )}
      {drawing.text && <RowText {...part} text={drawing.text} fontSizePx={fontSizePx} />}
    </>
  );
}

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
    () => popupMenuDrawing(solveNode, menu, geometry.rows, geometry.control.w),
    [solveNode, menu, geometry]
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
            const { item } = geometry.rows[index]!.entry;
            return (
              <RowParts
                key={index}
                drawing={drawing}
                iconRef={item.icon}
                fontSizePx={(item.separator ? menu.separatorFont : menu.font).sizePx}
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
          track={theme.widgets.scrollBar.scrollVertical}
          grabber={theme.widgets.scrollBar.grabber}
          color={tint.own}
          chromeSlot={orders.bars}
          snapToPixels={snapToPixels}
        />
      </CanvasItemGroup>
    </CanvasItemGroup>
  );
}
