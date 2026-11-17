import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import type { TscnNode } from '../../../parser/types';
import { Sprite2D } from '../sprite2d/Component';
import type { Sprite2DProperties } from '../sprite2d/types';
import { ShapeOverlay } from './ShapeOverlay';
import { useIsEditorHint } from '../../../r3f/contexts/EditorHintContext';
import { TouchScreenButtonVisibilityMode } from '../../../godot/scene/canvasNodes';
import type { TouchScreenButtonProperties } from './types';

function asUncentredSprite(
  node: TscnNode,
  props: TouchScreenButtonProperties,
  drawsTexture: boolean
): TscnNode {
  const sprite: Sprite2DProperties = {
    ...props,
    // The texture unsets, not the node, so a live edit keeps the children mounted.
    texture: drawsTexture ? props.texture_normal : undefined,
    centered: false,
    offset: { x: 0, y: 0 },
    flip_h: false,
    flip_v: false,
    region_enabled: false,
    hframes: 1,
    vframes: 1,
    frame: 0,
  };
  return { ...node, properties: sprite };
}

/** `DisplayServer::is_touchscreen_available()` in a browser: whether the page takes touch events. */
function hasTouchScreen(): boolean {
  return typeof window !== 'undefined' && 'ontouchstart' in window;
}

export function TouchScreenButton({ node, children }: NodeComponentProps) {
  const props = node.properties as TouchScreenButtonProperties;
  const isEditorHint = useIsEditorHint();
  // No finger is down, so `texture_pressed` never shows (`touch_screen_button.cpp:136-155`).
  const drawsTexture =
    isEditorHint ||
    props.visibility_mode !== TouchScreenButtonVisibilityMode.TOUCHSCREEN_ONLY ||
    hasTouchScreen();
  // Memoised so the Sprite2D below sees one properties object per node, as it does for a parsed Sprite2D.
  const spriteNode = useMemo(() => asUncentredSprite(node, props, drawsTexture), [node, props, drawsTexture]);

  return (
    <Sprite2D node={spriteNode}>
      <ShapeOverlay props={props} />
      {children}
    </Sprite2D>
  );
}
