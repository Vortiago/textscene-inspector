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
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { buttonIconColor } from '../button/nativeSolver';
import { PositionedStyleBox } from '../../../../r3f/controls/native/PositionedStyleBox';
import { IconButton, iconModulate } from '../../../../r3f/controls/native/IconButton';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import {
  multiplyModulate,
  useItemLinearColor,
  useItemLinearColorOf,
} from '../../../../r3f/canvasItemModulate';
import { LabelledText } from '../shared/LabelledText';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { GRAPH_EDIT_ICONS, GRAPH_EDIT_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';
import { scaledIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import type { Vector2 } from '../../../../godot/math/vector';
import { SPIN_BOX_ICONS } from '../spinbox/icons';
import {
  spinBoxArrowPosition,
  spinBoxIconColor,
  type SpinBoxButtonState,
  spinBoxLayout,
  spinBoxArrowIconSize,
} from '../spinbox/nativeSolver';
import { resolveToggleDrawState } from '../../../../r3f/controls/native/buttonBase';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Rgba } from '../../../../godot/math/math';
import { graphEditSnappingArrowStates, zoomLabelTextRect, type GraphEditToolbar } from './toolbar';
import type { GraphEditToolbarTheme } from './toolbarTheme';
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
  /** The `SpinBox` arrows, dimmed at the ends of the snapping range (`spin_box.cpp:635-646`). */
  snappingArrows: ReturnType<typeof graphEditSnappingArrowStates>;
  shape: (text: string) => TextLayoutResult;
  /** The `SpinBox` buttons block sits on the trailing edge (`spin_box.cpp:403,409`). */
  rtl: boolean;
  slot: CanvasSlot;
}

/** The tint and opacity of a SpinBox arrow in `state`. */
function useArrowColor(
  tint: Rgba,
  toolbarTheme: GraphEditToolbarTheme,
  direction: 'up' | 'down',
  state: SpinBoxButtonState
) {
  const color = useMemo(
    () => multiplyModulate(tint, spinBoxIconColor(toolbarTheme.spinBoxColors, direction, state)),
    [tint, toolbarTheme, direction, state]
  );
  return { linear: useItemLinearColor(color), alpha: color.a };
}

/** A SpinBox arrow in the toolbar's coordinates. */
function arrowPosition(spinBox: Rect2, button: Rect2, arrowSize: Vector2): { x: number; y: number } {
  const local = spinBoxArrowPosition(button, arrowSize);
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
  snappingArrows,
  shape,
  rtl,
  slot,
}: GraphEditToolbarProps) {
  const pieces = canvasSubOrders(slot, TOOLBAR_ITEM_PIECES);
  const labelColor = useMemo(
    () => multiplyModulate(tint.own, toolbarTheme.labelColor),
    [tint.own, toolbarTheme]
  );
  const fieldColor = useMemo(
    () => multiplyModulate(tint.own, toolbarTheme.fieldColor),
    [tint.own, toolbarTheme]
  );
  const upArrow = useArrowColor(tint.own, toolbarTheme, 'up', snappingArrows.up);
  const downArrow = useArrowColor(tint.own, toolbarTheme, 'down', snappingArrows.down);
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

  const toItemLinear = useItemLinearColorOf();
  const buttonIconTints = useMemo(
    () => ({
      normal: iconModulate(toItemLinear, tint, buttonIconColor(toolbarTheme.buttonColors, 'normal')),
      pressed: iconModulate(toItemLinear, tint, buttonIconColor(toolbarTheme.buttonColors, 'pressed')),
      disabled: iconModulate(toItemLinear, tint, buttonIconColor(toolbarTheme.buttonColors, 'disabled')),
    }),
    [toItemLinear, tint, toolbarTheme]
  );
  const { panelRect } = toolbar;
  const iconPx = scaledIconSize(GRAPH_EDIT_ICON_SIZE, theme.scale);
  const arrowSize = spinBoxArrowIconSize(theme.scale);
  const fieldBox = toolbarTheme.field.normal;

  return (
    <CanvasItemGroup position={[panelRect.x, -panelRect.y, 0]} renderOrder={slot.key}>
      <StyleBoxQuad
        styleBox={toolbarTheme.menuPanel}
        color={tint.own}
        rect={{ x: 0, y: 0, w: panelRect.w, h: panelRect.h }}
        renderOrder={slot.key}
      />

      {toolbar.items.map((item) => {
        if (item.kind === 'label') {
          const { labelBox } = toolbarTheme;
          return (
            <CanvasItemGroup key={item.id}>
              <PositionedStyleBox
                box={labelBox}
                rect={item.rect}
                tint={tint}
                renderOrder={pieces.boxes.key}
              />
              <LabelledText
                rect={zoomLabelTextRect(item.rect, labelBox)}
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
          const state = resolveToggleDrawState(item.disabled, item.pressed);
          const box = toolbarTheme.buttonBoxes[state];
          return (
            <CanvasItemGroup key={item.id}>
              <IconButton
                rect={item.rect}
                box={box}
                size={iconPx}
                texture={iconTextures[item.id] ?? null}
                tint={tint}
                iconTint={buttonIconTints[state]}
                iconAlignment={HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT}
                rtl={rtl}
                renderOrder={pieces.content.key}
                boxRenderOrder={pieces.boxes.key}
                canvasKey={pieces.content.key}
              />
            </CanvasItemGroup>
          );
        }

        // `SpinBox::_compute_sizes` (`spin_box.cpp:382-410`): the field box and
        // the up/down buttons block share the item's rect.
        const layout = spinBoxLayout({ x: item.rect.w, y: item.rect.h }, arrowSize.x, rtl);
        const fieldRect = { x: item.rect.x, y: item.rect.y, w: layout.fieldRect.w, h: layout.fieldRect.h };
        const upPos = arrowPosition(item.rect, layout.upRect, arrowSize);
        const downPos = arrowPosition(item.rect, layout.downRect, arrowSize);
        return (
          <CanvasItemGroup key={item.id}>
            <PositionedStyleBox box={fieldBox} rect={fieldRect} tint={tint} renderOrder={pieces.boxes.key} />
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
                w: arrowSize.x,
                h: arrowSize.y,
              }}
              texture={spinUpTexture}
              color={upArrow.linear}
              opacity={upArrow.alpha}
              renderOrder={pieces.content.key}
              canvasKey={pieces.content.key}
            />
            <PositionedIcon
              rect={{
                x: downPos.x,
                y: downPos.y,
                w: arrowSize.x,
                h: arrowSize.y,
              }}
              texture={spinDownTexture}
              color={downArrow.linear}
              opacity={downArrow.alpha}
              renderOrder={pieces.content.key}
              canvasKey={pieces.content.key}
            />
          </CanvasItemGroup>
        );
      })}
    </CanvasItemGroup>
  );
}
