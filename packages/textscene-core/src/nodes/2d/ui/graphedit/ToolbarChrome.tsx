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
import { buttonIconColor } from '../button/nativeSolver';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { multiplyModulate, useItemLinearColor } from '../../../../r3f/canvasItemModulate';
import { LabelledText } from '../shared/LabelledText';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { GRAPH_EDIT_ICONS, GRAPH_EDIT_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';
import { SPIN_BOX_ICONS } from '../spinbox/icons';
import {
  spinBoxArrowPosition,
  spinBoxIconColor,
  spinBoxLayout,
  SPIN_BOX_ARROW_ICON_SIZE,
} from '../spinbox/nativeSolver';
import {
  iconOnlyButtonIconRectIn,
  resolveToggleDrawState,
  tintColor,
} from '../../../../r3f/controls/native/buttonBase';
import type { Rect2 } from '../../../../godot/math/rect2';
import { graphEditMenuPanelStyleBox, type GraphEditToolbar, type ToolbarItem } from './toolbar';
import type { GraphEditToolbarTheme } from './toolbarTheme';
import { contentRect, isDrawn, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { canvasSubOrders, type CanvasSlot } from '../../../../r3f/canvasItemState';

interface GraphEditToolbarProps {
  toolbar: GraphEditToolbar;
  items: GraphEditToolbarTheme;
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
  box: StyleBoxFlatData;
  colors: GraphEditToolbarTheme['buttonColors'];
  tint: NativeControlComponentProps['tint'];
  rtl: boolean;
  renderOrder: number;
}

/**
 * One button icon, laid out by the Button painter's own placement (`button.cpp:349-405`): inside the
 * margins of the box its draw state reads, centred vertically, floored to a whole pixel, and modulated by
 * that state's `icon_*_color` (`button.cpp:281-288`).
 */
function ButtonIcon({ item, texture, box, colors, tint, rtl, renderOrder }: ButtonIconProps) {
  const state = resolveToggleDrawState(item.disabled, item.pressed);
  const iconColorSrgb = useMemo(
    () => tintColor(buttonIconColor(colors, state), tint.own),
    [colors, state, tint.own]
  );
  const linearColor = useItemLinearColor(iconColorSrgb);
  if (!texture) return null;
  const icon = iconOnlyButtonIconRectIn(
    item.rect,
    box.contentMargin,
    { x: GRAPH_EDIT_ICON_SIZE, y: GRAPH_EDIT_ICON_SIZE },
    rtl
  );
  if (!icon) return null;
  return (
    <PositionedIcon
      rect={icon}
      texture={texture}
      color={linearColor}
      opacity={iconColorSrgb.a}
      renderOrder={renderOrder}
      canvasKey={renderOrder}
    />
  );
}

/** A SpinBox arrow in the toolbar's coordinates. */
function arrowPosition(spinBox: Rect2, button: Rect2): { x: number; y: number } {
  const local = spinBoxArrowPosition(button, SPIN_BOX_ARROW_ICON_SIZE);
  return { x: spinBox.x + local.x, y: spinBox.y + local.y };
}

/** Each item is a child item of `menu_hbox` (`graph_edit.cpp:3235-3321`): its box draws before its content. */
const TOOLBAR_ITEM_PIECES = ['boxes', 'content'] as const;

export function GraphEditToolbarChrome({
  toolbar,
  items: toolbarTheme,
  icons,
  theme,
  tint,
  text,
  shape,
  rtl,
  slot,
}: GraphEditToolbarProps) {
  const pieces = canvasSubOrders(slot, TOOLBAR_ITEM_PIECES);
  const panelStyle = useMemo(() => graphEditMenuPanelStyleBox(theme), [theme]);
  const labelColor = useMemo(
    () => multiplyModulate(tint.own, toolbarTheme.labelColor),
    [tint.own, toolbarTheme]
  );
  const fieldColor = useMemo(
    () => multiplyModulate(tint.own, toolbarTheme.fieldColor),
    [tint.own, toolbarTheme]
  );
  const upArrowColor = useMemo(
    () => multiplyModulate(tint.own, spinBoxIconColor(toolbarTheme.spinBoxColors, 'up', 'normal')),
    [tint.own, toolbarTheme]
  );
  const downArrowColor = useMemo(
    () => multiplyModulate(tint.own, spinBoxIconColor(toolbarTheme.spinBoxColors, 'down', 'normal')),
    [tint.own, toolbarTheme]
  );
  const upArrowLinear = useItemLinearColor(upArrowColor);
  const downArrowLinear = useItemLinearColor(downArrowColor);
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
  const fieldBox = toolbarTheme.fieldBoxes.normal;

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
          const { labelBox } = toolbarTheme;
          return (
            <CanvasItemGroup key={item.id}>
              {isDrawn(labelBox) && (
                <CanvasItemGroup position={[item.rect.x, -item.rect.y, 0]}>
                  <StyleBoxQuad
                    styleBox={labelBox}
                    color={tint.own}
                    rect={{ x: 0, y: 0, w: item.rect.w, h: item.rect.h }}
                    renderOrder={pieces.boxes.key}
                  />
                </CanvasItemGroup>
              )}
              <LabelledText
                rect={contentRect(item.rect, labelBox)}
                layout={shape(text.zoomLabel)}
                fontSizePx={theme.fontSize}
                tint={labelColor}
                clippingPlanes={clippingPlanes}
                renderOrder={pieces.content.key}
                centred
              />
            </CanvasItemGroup>
          );
        }

        if (item.kind === 'button') {
          const box = toolbarTheme.buttonBoxes[resolveToggleDrawState(item.disabled, item.pressed)];
          return (
            <CanvasItemGroup key={item.id}>
              {isDrawn(box) && (
                <CanvasItemGroup position={[item.rect.x, -item.rect.y, 0]}>
                  <StyleBoxQuad
                    styleBox={box}
                    color={tint.own}
                    rect={{ x: 0, y: 0, w: item.rect.w, h: item.rect.h }}
                    renderOrder={pieces.boxes.key}
                  />
                </CanvasItemGroup>
              )}
              <ButtonIcon
                item={item}
                texture={iconTextures[item.id] ?? null}
                box={box}
                colors={toolbarTheme.buttonColors}
                tint={tint}
                rtl={rtl}
                renderOrder={pieces.content.key}
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
                styleBox={fieldBox}
                color={tint.own}
                rect={{ x: 0, y: 0, w: fieldRect.w, h: fieldRect.h }}
                renderOrder={pieces.boxes.key}
              />
            </CanvasItemGroup>
            <LabelledText
              rect={fieldRect}
              layout={shape(text.snappingDistance)}
              fontSizePx={theme.fontSize}
              tint={fieldColor}
              clippingPlanes={clippingPlanes}
              renderOrder={pieces.content.key}
              inset={fieldBox.contentMargin.left}
              rtl={rtl}
            />
            <PositionedIcon
              rect={{
                x: upPos.x,
                y: upPos.y,
                w: SPIN_BOX_ARROW_ICON_SIZE.x,
                h: SPIN_BOX_ARROW_ICON_SIZE.y,
              }}
              texture={spinUpTexture}
              color={upArrowLinear}
              opacity={upArrowColor.a}
              renderOrder={pieces.content.key}
              canvasKey={pieces.content.key}
            />
            <PositionedIcon
              rect={{
                x: downPos.x,
                y: downPos.y,
                w: SPIN_BOX_ARROW_ICON_SIZE.x,
                h: SPIN_BOX_ARROW_ICON_SIZE.y,
              }}
              texture={spinDownTexture}
              color={downArrowLinear}
              opacity={downArrowColor.a}
              renderOrder={pieces.content.key}
              canvasKey={pieces.content.key}
            />
          </CanvasItemGroup>
        );
      })}
    </CanvasItemGroup>
  );
}
