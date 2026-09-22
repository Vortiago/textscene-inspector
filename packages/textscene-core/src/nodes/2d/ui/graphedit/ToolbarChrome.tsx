/**
 * `<GraphEditToolbarChrome>` — paints the `menu_panel`/`menu_hbox` row
 * `GraphEdit`'s constructor builds (`scene/gui/graph_edit.cpp:3229-3324`),
 * off the geometry `toolbar.ts` solves.
 *
 * Its children are `INTERNAL_MODE_*` nodes of `top_layer`, itself added
 * `INTERNAL_MODE_BACK` (`:3183`), so the whole row paints AFTER every
 * GraphElement child — hence `renderOrder` here is the caller's
 * `subtreeChromeRenderOrder` band, never GraphEdit's own paint slot.
 *
 * Every button is a `FlatButton` (`:3249` and its siblings), whose `normal`
 * and `disabled` styleboxes are both `StyleBoxEmpty` (`default_theme.cpp:
 * 360-370`): only a PRESSED toggle draws a box. `icon_normal_color` and
 * `icon_pressed_color` are both opaque white (`default_theme.cpp:164-165`),
 * so those two states leave an icon's modulate alone — but `DRAW_DISABLED`
 * swaps in `icon_disabled_color` (`button.cpp:321-329`), and the variation
 * inherits `Button`'s own `Color(1, 1, 1, 0.4)` (`default_theme.cpp:169`).
 * With the box unchanged, that alpha is the entire drawn difference.
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
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { TextRun } from '../../../../r3f/controls/native/text/TextRun';
import { shapedTextSizeWidthPx, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { GRAPH_EDIT_ICONS, GRAPH_EDIT_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';
import { SPIN_BOX_ICONS } from '../spinbox/icons';
import { spinBoxLayout, SPIN_BOX_ARROW_ICON_SIZE } from '../spinbox/nativeSolver';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { graphEditMenuPanelStyleBox, type GraphEditToolbar, type ToolbarItem } from './toolbar';

/** `Label`'s own `font_color` (`default_theme.cpp:384`) — opaque white, unlike every other control's grey. */
const LABEL_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };
/** `control_font_color` (`default_theme.cpp:101`) — `LineEdit`'s own `font_color` (`:422`) and both SpinBox arrow modulates (`:634,638`). */
const CONTROL_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/** `icon_disabled_color` for `Button` (`default_theme.cpp:169`) — `Color(1, 1, 1, 0.4)`, so only the alpha moves. */
const ICON_DISABLED_ALPHA = 0.4;

/** `flat_button_pressed` (`default_theme.cpp:363-364`): `button_pressed` duplicated with `bg_color * Color(1, 1, 1, 0.85)`. */
function flatButtonPressedStyleBox(base: StyleBoxFlatData): StyleBoxFlatData {
  return { ...base, bgColor: { ...base.bgColor, a: base.bgColor.a * 0.85 } };
}


export interface GraphEditToolbarProps {
  toolbar: GraphEditToolbar;
  /** `solveNode.icons` — a scene's own `theme_override_icons/<key>` for any of the seven keys. */
  icons: NativeControlComponentProps['solveNode']['icons'];
  theme: NativeControlComponentProps['theme'];
  tint: NativeControlComponentProps['tint'];
  /** `snapping_distance_spinbox`'s displayed value and the zoom label's text, already formatted. */
  text: { zoomLabel: string; snappingDistance: string };
  shape: (text: string) => TextLayoutResult;
  /** `SpinBox`'s buttons block sits on the trailing edge (`spin_box.cpp:403,409`). */
  rtl: boolean;
  renderOrder: number;
}

interface ButtonIconProps {
  item: ToolbarItem;
  texture: THREE.Texture | null;
  contentMargin: number;
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

/**
 * One button's icon — `Button::_notification(NOTIFICATION_DRAW)`
 * (`button.cpp:349-400`) at the default LEFT/CENTER icon alignment
 * (`button.h:55-56`): flush against the stylebox's left margin, centred in
 * what the margins leave vertically.
 */
function ButtonIcon({ item, texture, contentMargin, tint, renderOrder }: ButtonIconProps) {
  if (!texture) return null;
  const x = item.rect.x + contentMargin;
  const y = item.rect.y + contentMargin + (item.rect.h - 2 * contentMargin - GRAPH_EDIT_ICON_SIZE) / 2;
  return (
    <CanvasItemGroup position={[x, -y, 0]}>
      <ControlQuad
        width={GRAPH_EDIT_ICON_SIZE}
        height={GRAPH_EDIT_ICON_SIZE}
        color={tint.color}
        opacity={item.disabled ? tint.opacity * ICON_DISABLED_ALPHA : tint.opacity}
        map={texture}
        renderOrder={renderOrder}
      />
    </CanvasItemGroup>
  );
}

interface ToolbarTextProps {
  rect: Rect2;
  layout: TextLayoutResult;
  fontSizePx: number;
  tint: ControlColor;
  clippingPlanes: THREE.Plane[];
  renderOrder: number;
  /** `HORIZONTAL_ALIGNMENT_CENTER` — `zoom_label`'s own (`graph_edit.cpp:3242`). The SpinBox field is LEFT (`spin_box.cpp:731`). */
  centred?: boolean;
  /** `LineEdit::_notification(NOTIFICATION_DRAW)`'s own `x_ofs` — the field text sits one content margin in. */
  inset?: number;
}

/** One run of text, vertically centred in `rect`. */
function ToolbarText({ rect, layout, fontSizePx, tint, clippingPlanes, renderOrder, centred, inset = 0 }: ToolbarTextProps) {
  const width = shapedTextSizeWidthPx(layout.widthPx);
  const x = centred ? Math.max(0, (rect.w - width) / 2) : inset;
  const y = Math.max(0, (rect.h - layout.heightPx) / 2);
  return (
    <CanvasItemGroup position={[rect.x + x, -(rect.y + y), 0]}>
      <TextRun layout={layout} fontSizePx={fontSizePx} tint={tint} clippingPlanes={clippingPlanes} renderOrder={renderOrder} />
    </CanvasItemGroup>
  );
}

export function GraphEditToolbarChrome({ toolbar, icons, theme, tint, text, shape, rtl, renderOrder }: GraphEditToolbarProps) {
  const panelStyle = useMemo(() => graphEditMenuPanelStyleBox(theme), [theme]);
  const pressedStyle = useMemo(() => flatButtonPressedStyleBox(theme.widgets.button.pressed), [theme]);
  const labelColor = useMemo(() => multiplyModulate(tint.own, LABEL_FONT_COLOR), [tint.own]);
  const fieldColor = useMemo(() => multiplyModulate(tint.own, CONTROL_FONT_COLOR), [tint.own]);
  const arrowColor = useGodotLinearColor(fieldColor);
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
    <CanvasItemGroup position={[panelRect.x, -panelRect.y, 0]}>
      <StyleBoxQuad
        styleBox={panelStyle}
        color={tint.own}
        rect={{ x: 0, y: 0, w: panelRect.w, h: panelRect.h }}
        renderOrder={renderOrder}
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
              renderOrder={renderOrder + 0.05}
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
                    renderOrder={renderOrder + 0.05}
                  />
                </CanvasItemGroup>
              )}
              <ButtonIcon
                item={item}
                texture={iconTextures[item.id] ?? null}
                contentMargin={theme.contentMargin}
                tint={tint}
                renderOrder={renderOrder + 0.1}
              />
            </CanvasItemGroup>
          );
        }

        // `SpinBox::_compute_sizes` (`spin_box.cpp:382-410`): the field box and
        // the up/down buttons block share the item's own rect.
        const layout = spinBoxLayout({ x: item.rect.w, y: item.rect.h }, SPIN_BOX_ARROW_ICON_SIZE.x, rtl);
        const fieldRect = { x: item.rect.x, y: item.rect.y, w: layout.fieldRect.w, h: layout.fieldRect.h };
        const upPos = {
          x: item.rect.x + layout.upRect.x + (layout.upRect.w - SPIN_BOX_ARROW_ICON_SIZE.x) / 2,
          y: item.rect.y + layout.upRect.y + (layout.upRect.h - SPIN_BOX_ARROW_ICON_SIZE.y) / 2,
        };
        const downPos = {
          x: item.rect.x + layout.downRect.x + (layout.downRect.w - SPIN_BOX_ARROW_ICON_SIZE.x) / 2,
          y: item.rect.y + layout.downRect.y + (layout.downRect.h - SPIN_BOX_ARROW_ICON_SIZE.y) / 2,
        };
        return (
          <CanvasItemGroup key={item.id}>
            <CanvasItemGroup position={[fieldRect.x, -fieldRect.y, 0]}>
              <StyleBoxQuad
                styleBox={theme.widgets.lineEdit.normal}
                color={tint.own}
                rect={{ x: 0, y: 0, w: fieldRect.w, h: fieldRect.h }}
                renderOrder={renderOrder + 0.05}
              />
            </CanvasItemGroup>
            <ToolbarText
              rect={fieldRect}
              layout={shape(text.snappingDistance)}
              fontSizePx={theme.fontSize}
              tint={fieldColor}
              clippingPlanes={clippingPlanes}
              renderOrder={renderOrder + 0.1}
              inset={lineEditInsetX}
            />
            {spinUpTexture && (
              <CanvasItemGroup position={[upPos.x, -upPos.y, 0]}>
                <ControlQuad
                  width={SPIN_BOX_ARROW_ICON_SIZE.x}
                  height={SPIN_BOX_ARROW_ICON_SIZE.y}
                  color={arrowColor}
                  opacity={tint.opacity}
                  map={spinUpTexture}
                  renderOrder={renderOrder + 0.1}
                />
              </CanvasItemGroup>
            )}
            {spinDownTexture && (
              <CanvasItemGroup position={[downPos.x, -downPos.y, 0]}>
                <ControlQuad
                  width={SPIN_BOX_ARROW_ICON_SIZE.x}
                  height={SPIN_BOX_ARROW_ICON_SIZE.y}
                  color={arrowColor}
                  opacity={tint.opacity}
                  map={spinDownTexture}
                  renderOrder={renderOrder + 0.1}
                />
              </CanvasItemGroup>
            )}
          </CanvasItemGroup>
        );
      })}
    </CanvasItemGroup>
  );
}

