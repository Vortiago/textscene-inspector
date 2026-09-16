/**
 * `<GraphEditMinimapChrome>` — paints `GraphEditMinimap`, the overview panel
 * GraphEdit's constructor builds at the bottom-right of its own rect
 * (`scene/gui/graph_edit.cpp:3325-3340`), off the geometry `minimap.ts`
 * solves. `GraphEdit::_minimap_draw` (`:1807-1891`) is the draw itself:
 * panel, every GraphFrame, every GraphNode, the connections, the camera
 * viewport, then the resizer icon.
 *
 * `minimap->set_modulate(Color(1, 1, 1, minimap_opacity))` (`:3330`) is a
 * CanvasItem modulate, so it multiplies every draw below — folded into each
 * quad's own sRGB colour here, before the single linear conversion, the same
 * ordering every other two-colour chrome in this codebase uses.
 *
 * NOT DRAWN: the connection polylines (`:1869-1881`). They are
 * `draw_polyline_colors(..., 0.5, lines_antialiased)`, a hairline with its
 * own antialiasing variant that no other painter in this codebase needs;
 * `comparison.md` records the gap.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import {
  GRAPH_EDIT_ICON_SIZE,
  GRAPH_EDIT_MINIMAP_RESIZER_ICON,
} from '../../../../r3f/controls/native/themeIcons';
import { DEFAULT_CONTENT_MARGIN } from '../../../../r3f/controls/godotDefaultTheme';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
import type { MinimapTransform, GraphScrollBounds, MinimapElement } from './minimap';
import { minimapCameraRect, minimapNodeRect } from './minimap';

/** `GraphEditMinimap`'s `resizer_color` (`default_theme.cpp:1350`). */
const RESIZER_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 0.85 };

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };

function flatBox(
  bgColor: ControlColor,
  cornerRadius: number,
  borderWidth: number,
  borderColor: ControlColor
): StyleBoxFlatData {
  return {
    bgColor,
    borderColor,
    borderWidth: { left: borderWidth, top: borderWidth, right: borderWidth, bottom: borderWidth },
    cornerRadius: {
      topLeft: cornerRadius,
      topRight: cornerRadius,
      bottomRight: cornerRadius,
      bottomLeft: cornerRadius,
    },
    expandMargin: ZERO_SIDES,
    contentMargin: ZERO_SIDES,
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

export interface GraphEditMinimapProps {
  /** The minimap panel's rect in GraphEdit's own local space. */
  rect: Rect2;
  transform: MinimapTransform;
  bounds: GraphScrollBounds;
  /** Frames first, then nodes — `_minimap_draw`'s own two loops. */
  elements: readonly MinimapElement[];
  /** `GraphEdit::zoom` — each element's box is scaled by it before conversion (`:1827-1829`). */
  zoom: number;
  scrollOffset: { x: number; y: number };
  graphEditSize: { x: number; y: number };
  /** `minimap->get_modulate().a`. */
  opacity: number;
  icons: NativeControlComponentProps['solveNode']['icons'];
  theme: NativeControlComponentProps['theme'];
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

export function GraphEditMinimapChrome({
  rect,
  transform,
  bounds,
  elements,
  zoom,
  scrollOffset,
  graphEditSize,
  opacity,
  icons,
  theme,
  tint,
  renderOrder,
}: GraphEditMinimapProps) {
  const scale = theme.contentMargin / DEFAULT_CONTENT_MARGIN;
  // Every draw inside the minimap carries its own `modulate` alpha.
  const modulated = useMemo(
    () => multiplyModulate(tint.own, { r: 1, g: 1, b: 1, a: opacity }),
    [tint.own, opacity]
  );

  // `default_theme.cpp:1342` — make_flat_stylebox(Color(0.24, 0.24, 0.24), 0, 0, 0, 0).
  const panelStyle = useMemo(
    () => flatBox({ r: 0.24, g: 0.24, b: 0.24, a: 1 }, theme.cornerRadius, 0, { r: 0.8, g: 0.8, b: 0.8, a: 1 }),
    [theme.cornerRadius]
  );
  // `default_theme.cpp:1343-1345` — make_flat_stylebox(Color(0.65, 0.65, 0.65, 0.2), 0, 0, 0, 0, 0)
  // then `set_border_width_all(1)` / `set_border_color(Color(0.65, 0.65, 0.65, 0.45))`, both unscaled.
  const cameraStyle = useMemo(
    () => flatBox({ r: 0.65, g: 0.65, b: 0.65, a: 0.2 }, 0, 1, { r: 0.65, g: 0.65, b: 0.65, a: 0.45 }),
    []
  );
  // `default_theme.cpp:1347` — make_flat_stylebox(Color(1, 1, 1), 0, 0, 0, 0, 2); the bg is replaced per element.
  const nodeCornerRadius = Math.round(2 * scale);

  const resizerTexture = useNodeIcon(icons.resizer, GRAPH_EDIT_MINIMAP_RESIZER_ICON);
  const resizerColor = useGodotLinearColor(useMemo(() => multiplyModulate(modulated, RESIZER_COLOR), [modulated]));
  const resizerOpacity = modulated.a * RESIZER_COLOR.a;

  const cameraRect = minimapCameraRect(transform, bounds, scrollOffset, graphEditSize);

  return (
    <CanvasItemGroup position={[rect.x, -rect.y, 0]}>
      <StyleBoxQuad
        styleBox={panelStyle}
        color={modulated}
        rect={{ x: 0, y: 0, w: rect.w, h: rect.h }}
        renderOrder={renderOrder}
      />

      {elements.map((element) => {
        const nodeRect = minimapNodeRect(transform, bounds, element, zoom);
        const style = flatBox(element.bgColor, nodeCornerRadius, 0, { r: 0.8, g: 0.8, b: 0.8, a: 1 });
        return (
          <CanvasItemGroup key={element.key} position={[nodeRect.x, -nodeRect.y, 0]}>
            <StyleBoxQuad
              styleBox={style}
              color={modulated}
              rect={{ x: 0, y: 0, w: nodeRect.w, h: nodeRect.h }}
              renderOrder={renderOrder + 0.02}
            />
          </CanvasItemGroup>
        );
      })}

      <CanvasItemGroup position={[cameraRect.x, -cameraRect.y, 0]}>
        <StyleBoxQuad
          styleBox={cameraStyle}
          color={modulated}
          rect={{ x: 0, y: 0, w: cameraRect.w, h: cameraRect.h }}
          renderOrder={renderOrder + 0.04}
        />
      </CanvasItemGroup>

      {resizerTexture && (
        <ControlQuad
          width={GRAPH_EDIT_ICON_SIZE}
          height={GRAPH_EDIT_ICON_SIZE}
          color={resizerColor}
          opacity={resizerOpacity}
          map={resizerTexture}
          renderOrder={renderOrder + 0.06}
        />
      )}
    </CanvasItemGroup>
  );
}
