/**
 * One embedded window as its embedder draws it (`Viewport::_sub_window_update`,
 * `scene/main/viewport.cpp:342-401`): the border StyleBox, the title and the close icon unless the
 * window is borderless, then the window's own target over its rect.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';
import { CanvasItemGroup, CanvasItemKeyProvider } from '../../../r3f/components/CanvasItemGroup';
import { ControlQuad } from '../../../r3f/controls/native/controlQuad';
import { StyleBoxQuad } from '../../../r3f/controls/native/StyleBoxQuad';
import { useNodeIcon } from '../../../r3f/controls/native/useIconTexture';
import { TAB_BAR_ICONS, TAB_BAR_ICON_SIZE } from '../../../r3f/controls/native/themeIcons';
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
import { viewportSize } from '../../viewport/subviewport/targetSize';
import { closeIconOrigin } from './decoration';
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

/**
 * The rect the window takes in its embedder. A centred window centres its loaded size, before its
 * Controls wrap it (`window.cpp:1555-1560`). The size is the one its viewport holds now.
 */
function useWindowRect(solveNode: SolveNode, path: string, embedderSize: Vector2): Rect2 {
  const props = solveNode.node.properties as WindowProperties;
  const size = viewportSize(props.size, useViewportRect(path));
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
  const slots = canvasSubOrders(wholeKeySlot(key), ['title', 'close', 'content'] as const);
  const { texture } = useViewportTargetSlot(path, null, 'plain');

  return (
    // Every group here carries the key: three takes `groupOrder` from the nearest enclosing group.
    <group
      name={`${solveNode.node.type}:${solveNode.node.name}`}
      position={[rect.x, -rect.y, 0]}
      renderOrder={key}
    >
      <CanvasItemKeyProvider value={key}>
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
        {texture ? (
          <ControlQuad
            width={rect.w}
            height={rect.h}
            color={WHITE}
            opacity={1}
            map={texture}
            renderOrder={slots.content.key}
          />
        ) : null}
      </CanvasItemKeyProvider>
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

/** The pixel size of a loaded icon, or the vendored icon's own until it loads. */
function iconSize(texture: THREE.Texture | null): Vector2 {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  return { x: image?.width ?? TAB_BAR_ICON_SIZE, y: image?.height ?? TAB_BAR_ICON_SIZE };
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
  // `close` and the TabBar's `close` are one default icon, `icons["close"]` (`default_theme.cpp:685,1039`).
  const closeTexture = useNodeIcon(solveNode.icons.close, TAB_BAR_ICONS.close);
  const closeSize = iconSize(closeTexture);
  const rect: Rect2 = { x: 0, y: 0, w: size.x, h: size.y };
  const closeOrigin = closeIconOrigin(rect, offsets);

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
