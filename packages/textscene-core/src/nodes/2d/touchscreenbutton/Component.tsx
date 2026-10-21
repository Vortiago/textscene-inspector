/**
 * Draws a TouchScreenButton's `texture_normal` as a Sprite2D's uncentred quad at the node origin. The
 * editor draws it whatever `visibility_mode` says, and no finger is down, so `texture_pressed` never
 * shows (`touch_screen_button.cpp:136-155`). The Sprite2D root stays mounted with no texture set, so a
 * live edit does not remount the children.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { YSortDispatcher } from '../../../r3f/YSortDispatcher.js';
import type { TscnNode } from '../../../parser/types';
import { Sprite2D } from '../sprite2d/Component';
import type { Sprite2DProperties } from '../sprite2d/types';
import { ShapeOverlay } from './ShapeOverlay';
import type { TouchScreenButtonProperties } from './types';

function asUncentredSprite(node: TscnNode, props: TouchScreenButtonProperties): TscnNode {
  const sprite: Sprite2DProperties = {
    ...props,
    texture: props.texture_normal,
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

export function TouchScreenButton({ node, children }: NodeComponentProps) {
  const props = node.properties as TouchScreenButtonProperties;
  // Memoised so the Sprite2D below sees one properties object per node, as it does for a parsed Sprite2D.
  const spriteNode = useMemo(() => asUncentredSprite(node, props), [node, props]);

  return (
    <Sprite2D node={spriteNode}>
      <ShapeOverlay props={props} />
      {props.y_sort_enabled ? <YSortDispatcher node={node}>{children}</YSortDispatcher> : children}
    </Sprite2D>
  );
}
