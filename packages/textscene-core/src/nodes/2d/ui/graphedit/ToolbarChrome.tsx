/**
 * `<GraphEditToolbarChrome>`: paints the `menu_panel` row the `GraphEdit` constructor builds
 * (`scene/gui/graph_edit.cpp:3229-3324`) from the geometry of `toolbar.ts`. The row is chrome
 * of `top_layer` (`:3183`), so it draws in the slot the caller hands out after its subtree.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { TextureQuad } from '../../../../r3f/controls/native/TextureQuad';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { multiplyModulate, useItemLinearColor } from '../../../../r3f/canvasItemModulate';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import {
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { GRAPH_EDIT_ICONS, GRAPH_EDIT_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';
import { SPIN_BOX_ICONS } from '../spinbox/icons';
import { spinBoxArrowPosition, spinBoxLayout, SPIN_BOX_ARROW_ICON_SIZE } from '../spinbox/nativeSolver';
import { layoutButtonContent } from '../../../../r3f/controls/native/buttonBase';
import { HorizontalAlignment, VerticalAlignment } from '../../../../godot/math/alignment';
import type { Rect2 } from '../../../../godot/math/rect2';
import { flatButtonBoxes } from '../../../../r3f/controls/native/flatButtonBoxes';
import { graphEditMenuPanelStyleBox, type GraphEditToolbar, type ToolbarItem } from './toolbar';
import type { Rgba } from '../../../../godot/math/math';
import { CONTROL_FONT_COLOR } from '../../../../godot/scene/theme';
import { canvasSubOrders, type CanvasSlot } from '../../../../r3f/canvasItemState';

/** The `font_color` of `Label` (`default_theme.cpp:384`): opaque white, where other controls use grey. */
const LABEL_FONT_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/**
 * `DRAW_DISABLED` swaps in `icon_disabled_color` (`button.cpp:321-329`), `Color(1, 1, 1, 0.4)` for
 * `Button` (`default_theme.cpp:169`). `icon_normal_color` and `icon_pressed_color` are opaque white
 * (`default_theme.cpp:164-165`), so a disabled icon differs only in alpha.
 */
const ICON_DISABLED_ALPHA = 0.4;

interface GraphEditToolbarProps {
  toolbar: GraphEditToolbar;
  /** `solveNode.icons`: the scene's `theme_override_icons/<key>` for any of the seven keys. */
  icons: NativeControlComponentProps['solveNode']['icons'];
  theme: NativeControlComponentProps['theme'];
  tint: NativeControlComponentProps['tint'];
  /** The formatted value of `snapping_distance_spinbox` and the text of the zoom label. */
  text: { zoomLabel: string; snappingDistance: string };
  shape: (text: string) => TextLayoutResult;
  /** The `SpinBox` buttons block sits on the trailing edge (`spin_box.cpp:403,409`). */
  rtl: boolean;
  slot: CanvasSlot;
}

interface ButtonIconProps {
  item: ToolbarItem;
  texture: THREE.Texture | null;
  contentMargin: number;
  tint: NativeControlComponentProps['tint'];
  rtl: boolean;
  renderOrder: number;
}

/**
 * One button icon, laid out by the Button painter's own placement (`button.cpp:349-405`): at the
 * stylebox's left margin, centred vertically, floored to a whole pixel.
 */
function ButtonIcon({ item, texture, contentMargin, tint, rtl, renderOrder }: ButtonIconProps) {
  if (!texture) return null;
  const layout = layoutButtonContent({
    rectSize: { x: item.rect.w, y: item.rect.h },
    styleMargin: { left: contentMargin, top: contentMargin, right: contentMargin, bottom: contentMargin },
    hSeparation: 0,
    iconMaxWidth: 0,
    textAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER,
    iconAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
    verticalIconAlignment: VerticalAlignment.VERTICAL_ALIGNMENT_CENTER,
    expandIcon: false,
    iconNaturalSize: { x: GRAPH_EDIT_ICON_SIZE, y: GRAPH_EDIT_ICON_SIZE },
    hasText: false,
    textNaturalSize: { x: 0, y: 0 },
    isTextRtl: false,
    rtl,
  });
  if (!layout.icon) return null;
  const { x, y, w, h } = layout.icon.rect;
  return (
    <TextureQuad
      rect={{ x: item.rect.x + x, y: item.rect.y + y, w, h }}
      texture={texture}
      color={tint.color}
      opacity={item.disabled ? tint.opacity * ICON_DISABLED_ALPHA : tint.opacity}
      renderOrder={renderOrder}
    />
  );
}

/** A SpinBox arrow in the toolbar's coordinates. */
function arrowPosition(spinBox: Rect2, button: Rect2): { x: number; y: number } {
  const local = spinBoxArrowPosition(button, SPIN_BOX_ARROW_ICON_SIZE);
  return { x: spinBox.x + local.x, y: spinBox.y + local.y };
}

interface ToolbarTextProps {
  rect: Rect2;
  layout: TextLayoutResult;
  fontSizePx: number;
  tint: Rgba;
  clippingPlanes: THREE.Plane[];
  renderOrder: number;
  /** `HORIZONTAL_ALIGNMENT_CENTER`, as `zoom_label` sets (`graph_edit.cpp:3242`). The SpinBox field is LEFT (`spin_box.cpp:731`). */
  centred?: boolean;
  /** The `x_ofs` of `LineEdit::_notification(NOTIFICATION_DRAW)`: the field text sits one content margin in. */
  inset?: number;
}

/** One run of text, vertically centred in `rect`. */
function ToolbarText({
  rect,
  layout,
  fontSizePx,
  tint,
  clippingPlanes,
  renderOrder,
  centred,
  inset = 0,
}: ToolbarTextProps) {
  const width = shapedTextSizeWidthPx(layout.widthPx);
  const x = centred ? Math.max(0, (rect.w - width) / 2) : inset;
  const y = Math.max(0, (rect.h - layout.heightPx) / 2);
  return (
    <CanvasItemGroup position={[rect.x + x, -(rect.y + y), 0]} renderOrder={renderOrder}>
      <TextRun
        layout={layout}
        fontSizePx={fontSizePx}
        tint={tint}
        clippingPlanes={clippingPlanes}
        renderOrder={renderOrder}
      />
    </CanvasItemGroup>
  );
}

/** Each item is a child item of `menu_hbox` (`graph_edit.cpp:3235-3321`): its box draws before its content. */
const TOOLBAR_ITEM_PIECES = ['boxes', 'content'] as const;

export function GraphEditToolbarChrome({
  toolbar,
  icons,
  theme,
  tint,
  text,
  shape,
  rtl,
  slot,
}: GraphEditToolbarProps) {
  const items = canvasSubOrders(slot, TOOLBAR_ITEM_PIECES);
  const panelStyle = useMemo(() => graphEditMenuPanelStyleBox(theme), [theme]);
  const pressedStyle = useMemo(() => flatButtonBoxes(theme).pressed, [theme]);
  const labelColor = useMemo(() => multiplyModulate(tint.own, LABEL_FONT_COLOR), [tint.own]);
  const fieldColor = useMemo(() => multiplyModulate(tint.own, CONTROL_FONT_COLOR), [tint.own]);
  const arrowColor = useItemLinearColor(fieldColor);
  const clippingPlanes = useControlClipPlanes() as THREE.Plane[];

  const iconTextures: Record<string, THREE.Texture | null> = {
    zoom_minus: useNodeIcon(icons.zoom_out, GRAPH_EDIT_ICONS.zoomOut),
    zoom_reset: useNodeIcon(icons.zoom_reset, GRAPH_EDIT_ICONS.zoomReset),
    zoom_plus: useNodeIcon(icons.zoom_in, GRAPH_EDIT_ICONS.zoomIn),
    toggle_grid: useNodeIcon(icons.grid_toggle, GRAPH_EDIT_ICONS.gridToggle),
    toggle_snapping: useNodeIcon(icons.snapping_toggle, GRAPH_EDIT_ICONS.snappingToggle),
    minimap: useNodeIcon(icons.minimap_toggle, GRAPH_EDIT_ICONS.minimapToggle),
    arrange: useNodeIcon(icons.layout, GRAPH_EDIT_ICONS.layout),
  };
  const spinUpTexture = useNodeIcon(icons.up, SPIN_BOX_ICONS.up);
  const spinDownTexture = useNodeIcon(icons.down, SPIN_BOX_ICONS.down);

  const { panelRect } = toolbar;
  const lineEditInsetX = theme.widgets.lineEdit.normal.contentMargin.left;

  return (
    <CanvasItemGroup position={[panelRect.x, -panelRect.y, 0]} renderOrder={slot.key}>
      <StyleBoxQuad
        styleBox={panelStyle}
        color={tint.own}
        rect={{ x: 0, y: 0, w: panelRect.w, h: panelRect.h }}
        renderOrder={slot.key}
      />

      {toolbar.items.map((item) => {
        if (item.kind === 'label') {
          return (
            <ToolbarText
              key={item.id}
              rect={item.rect}
              layout={shape(text.zoomLabel)}
              fontSizePx={theme.fontSize}
              tint={labelColor}
              clippingPlanes={clippingPlanes}
              renderOrder={items.content.key}
              centred
            />
          );
        }

        if (item.kind === 'button') {
          return (
            <CanvasItemGroup key={item.id}>
              {item.pressed && (
                <CanvasItemGroup position={[item.rect.x, -item.rect.y, 0]}>
                  <StyleBoxQuad
                    styleBox={pressedStyle}
                    color={tint.own}
                    rect={{ x: 0, y: 0, w: item.rect.w, h: item.rect.h }}
                    renderOrder={items.boxes.key}
                  />
                </CanvasItemGroup>
              )}
              <ButtonIcon
                item={item}
                texture={iconTextures[item.id] ?? null}
                contentMargin={theme.contentMargin}
                tint={tint}
                rtl={rtl}
                renderOrder={items.content.key}
              />
            </CanvasItemGroup>
          );
        }

        // `SpinBox::_compute_sizes` (`spin_box.cpp:382-410`): the field box and
        // the up/down buttons block share the item's rect.
        const layout = spinBoxLayout({ x: item.rect.w, y: item.rect.h }, SPIN_BOX_ARROW_ICON_SIZE.x, rtl);
        const fieldRect = { x: item.rect.x, y: item.rect.y, w: layout.fieldRect.w, h: layout.fieldRect.h };
        const upPos = arrowPosition(item.rect, layout.upRect);
        const downPos = arrowPosition(item.rect, layout.downRect);
        return (
          <CanvasItemGroup key={item.id}>
            <CanvasItemGroup position={[fieldRect.x, -fieldRect.y, 0]}>
              <StyleBoxQuad
                styleBox={theme.widgets.lineEdit.normal}
                color={tint.own}
                rect={{ x: 0, y: 0, w: fieldRect.w, h: fieldRect.h }}
                renderOrder={items.boxes.key}
              />
            </CanvasItemGroup>
            <ToolbarText
              rect={fieldRect}
              layout={shape(text.snappingDistance)}
              fontSizePx={theme.fontSize}
              tint={fieldColor}
              clippingPlanes={clippingPlanes}
              renderOrder={items.content.key}
              inset={lineEditInsetX}
            />
            {spinUpTexture && (
              <TextureQuad
                rect={{
                  x: upPos.x,
                  y: upPos.y,
                  w: SPIN_BOX_ARROW_ICON_SIZE.x,
                  h: SPIN_BOX_ARROW_ICON_SIZE.y,
                }}
                texture={spinUpTexture}
                color={arrowColor}
                opacity={tint.opacity}
                renderOrder={items.content.key}
              />
            )}
            {spinDownTexture && (
              <TextureQuad
                rect={{
                  x: downPos.x,
                  y: downPos.y,
                  w: SPIN_BOX_ARROW_ICON_SIZE.x,
                  h: SPIN_BOX_ARROW_ICON_SIZE.y,
                }}
                texture={spinDownTexture}
                color={arrowColor}
                opacity={tint.opacity}
                renderOrder={items.content.key}
              />
            )}
          </CanvasItemGroup>
        );
      })}
    </CanvasItemGroup>
  );
}
