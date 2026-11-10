/**
 * One embedded window as its embedder draws it (`Viewport::_sub_window_update`,
 * `scene/main/viewport.cpp:342-401`): the border StyleBox, the title and the close icon unless the
 * window is borderless, then the window's own target over the rect its content scale gives.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';
import { CanvasItemGroup, CanvasItemProvider } from '../../../r3f/components/CanvasItemGroup';
import { ControlQuad } from '../../../r3f/controls/native/controlQuad';
import { StyleBoxQuad } from '../../../r3f/controls/native/StyleBoxQuad';
import { useNodeIcon } from '../../../r3f/controls/native/useIconTexture';
import { TAB_BAR_ICONS, TAB_BAR_ICON_SIZE } from '../../../r3f/controls/native/themeIcons';
import { scaledIconSize, scaledSvgDataUrl } from '../../../r3f/controls/native/scaledSvgIcon';
import {
  canvasSubOrders,
  useCanvasItemState,
  wholeKeySlot,
  type CanvasSlot,
} from '../../../r3f/canvasItemState';
import { WHITE_MODULATE } from '../../../r3f/canvasItemModulate';
import { useInheritedTextureSampler } from '../../../r3f/canvasItemTextureSampler';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { useViewportTargetSlot } from '../../../resources/textures/viewporttexture/useViewportTextureSlot';
import { InitialPosition, centredWindowPosition } from '../../../godot/scene/window';
import { imageSize } from '../../../resources/formats/image/imagePixels';
import { closeIconOrigin } from './decoration';
import { windowContentScale } from './contentScale';
import { WindowTitle } from './WindowTitle';
import { windowThemeDefaults, type WindowThemeDefaults } from './theme';
import type { WindowProperties } from './types';

interface EmbeddedWindowFrameProps {
  solveNode: SolveNode;
  /** The window's live path, which keys its target and its size. */
  path: string;
  /** Whether the window holds the embedder's focus, which picks `embedded_border`. */
  isFocused: boolean;
  /** The window's place in the stack, back to front (`canvas_item_set_draw_index`, `viewport.cpp:300`). */
  drawIndex: number;
  embedderSize: Vector2;
  theme: NativeTheme;
}

const WHITE = new THREE.Color(1, 1, 1);
const BLACK = new THREE.Color(0, 0, 0);

/**
 * The rect the window takes in its embedder. A centred window centres its loaded size, before its
 * Controls wrap it (`window.cpp:1555-1560`). The size is the window's, not its target's: an embedded
 * window keeps 1 pixel at least (`window.cpp:1208`), where its target floors at 2.
 */
function useWindowRect(solveNode: SolveNode, path: string, embedderSize: Vector2): Rect2 {
  const props = solveNode.node.properties as WindowProperties;
  const shown = useViewportRect(path) ?? props.size;
  const size = { x: Math.max(shown.x, 1), y: Math.max(shown.y, 1) };
  const position =
    props.initial_position === InitialPosition.ABSOLUTE
      ? props.position
      : centredWindowPosition(embedderSize, props.size);
  return { x: position.x, y: position.y, w: size.x, h: size.y };
}

export function EmbeddedWindowFrame({
  solveNode,
  path,
  isFocused,
  drawIndex,
  embedderSize,
  theme,
}: EmbeddedWindowFrameProps) {
  const props = solveNode.node.properties as WindowProperties;
  const rect = useWindowRect(solveNode, path, embedderSize);
  const defaults = useMemo(() => windowThemeDefaults(theme), [theme]);
  // The subwindow canvas item: no modulate, z 0, and the draw index as its sequence.
  const { key } = useCanvasItemState({
    modulate: WHITE_MODULATE,
    selfModulate: WHITE_MODULATE,
    zIndex: 0,
    zAsRelative: true,
    material: null,
    // The viewport's default filter and repeat: the subwindow canvas item names neither.
    sampler: useInheritedTextureSampler(undefined, undefined),
    lightMask: undefined,
    sequence: drawIndex,
  });
  const slots = canvasSubOrders(wholeKeySlot(key), ['title', 'close', 'bars', 'content'] as const);
  const { texture } = useViewportTargetSlot(path, null, 'plain');
  const { drawRect } = useMemo(
    () => windowContentScale({ x: rect.w, y: rect.h }, props.content_scale),
    [rect.w, rect.h, props.content_scale]
  );
  // `vr != r`: the target leaves part of the window, which `Color()` fills opaque black (`viewport.cpp:397-399`).
  const hasBars = drawRect.x !== 0 || drawRect.y !== 0 || drawRect.w !== rect.w || drawRect.h !== rect.h;

  return (
    // Every group here carries the key: three takes `groupOrder` from the nearest enclosing group.
    <group
      name={`${solveNode.node.type}:${solveNode.node.name}`}
      position={[rect.x, -rect.y, 0]}
      renderOrder={key}
    >
      <CanvasItemProvider value={key}>
        {props.borderless ? null : (
          <WindowDecoration
            solveNode={solveNode}
            size={{ x: rect.w, y: rect.h }}
            isFocused={isFocused}
            defaults={defaults}
            theme={theme}
            borderKey={key}
            titleSlot={slots.title}
            closeKey={slots.close.key}
          />
        )}
        {hasBars ? (
          <ControlQuad
            width={rect.w}
            height={rect.h}
            color={BLACK}
            opacity={1}
            renderOrder={slots.bars.key}
          />
        ) : null}
        {texture ? (
          <CanvasItemGroup position={[drawRect.x, -drawRect.y, 0]}>
            <ControlQuad
              width={drawRect.w}
              height={drawRect.h}
              color={WHITE}
              opacity={1}
              map={texture}
              renderOrder={slots.content.key}
            />
          </CanvasItemGroup>
        ) : null}
      </CanvasItemProvider>
    </group>
  );
}

interface WindowDecorationProps {
  solveNode: SolveNode;
  size: Vector2;
  isFocused: boolean;
  defaults: WindowThemeDefaults;
  theme: NativeTheme;
  borderKey: number;
  titleSlot: CanvasSlot;
  closeKey: number;
}

/** The pixel size of a loaded icon, or the vendored icon's at the theme scale until it loads. */
function iconSize(texture: THREE.Texture | null, scale: number): Vector2 {
  const size = imageSize(texture?.image);
  const vendored = scaledIconSize(TAB_BAR_ICON_SIZE, scale);
  return size ? { x: size.width, y: size.height } : { x: vendored, y: vendored };
}

function WindowDecoration({
  solveNode,
  size,
  isFocused,
  defaults,
  theme,
  borderKey,
  titleSlot,
  closeKey,
}: WindowDecorationProps) {
  const { styleBoxes, constants } = solveNode;
  const border = isFocused
    ? (styleBoxes.embedded_border ?? defaults.embeddedBorder)
    : (styleBoxes.embedded_unfocused_border ?? defaults.embeddedUnfocusedBorder);
  const offsets = {
    closeHOffset: constants.close_h_offset ?? defaults.closeHOffset,
    closeVOffset: constants.close_v_offset ?? defaults.closeVOffset,
  };
  // `close` and the TabBar's `close` are one default icon, `icons["close"]` (`default_theme.cpp:685,1039`),
  // rasterised at the theme scale.
  const vendoredClose = useMemo(() => scaledSvgDataUrl(TAB_BAR_ICONS.close, theme.scale), [theme.scale]);
  const closeTexture = useNodeIcon(solveNode.icons.close, vendoredClose);
  const closeSize = iconSize(closeTexture, theme.scale);
  const rect: Rect2 = { x: 0, y: 0, w: size.x, h: size.y };
  const closeOrigin = closeIconOrigin(size.x, offsets);

  return (
    <>
      <StyleBoxQuad styleBox={border} rect={rect} renderOrder={borderKey} />
      <WindowTitle
        solveNode={solveNode}
        width={size.x}
        border={border}
        closeHOffset={offsets.closeHOffset}
        defaults={defaults}
        theme={theme}
        slot={titleSlot}
      />
      {closeTexture ? (
        <CanvasItemGroup position={[closeOrigin.x, -closeOrigin.y, 0]}>
          <ControlQuad
            width={closeSize.x}
            height={closeSize.y}
            color={WHITE}
            opacity={1}
            map={closeTexture}
            renderOrder={closeKey}
          />
        </CanvasItemGroup>
      ) : null}
    </>
  );
}
