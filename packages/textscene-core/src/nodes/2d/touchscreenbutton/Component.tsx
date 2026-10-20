/**
 * Draws a TouchScreenButton: its `texture_normal` with the top-left corner at the node origin. The
 * editor draws that texture whatever `visibility_mode` says, and no finger is down, so
 * `texture_pressed` never shows (`touch_screen_button.cpp:136-155`). The draw is a Sprite2D's
 * uncentred quad, so the button hands the Sprite2D component those properties.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import type { TscnNode } from '../../../parser/types';
import { Node2D } from '../../base/node2d/Component';
import { Sprite2D } from '../sprite2d/Component';
import type { Sprite2DProperties } from '../sprite2d/types';
import type { TouchScreenButtonProperties } from './types';

function asUncentredSprite(node: TscnNode, props: TouchScreenButtonProperties, texture: string): TscnNode {
  const sprite: Sprite2DProperties = {
    ...props,
    texture,
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
  // Memoised so the Sprite2D below sees one properties object per node, as it does for a parsed Sprite2D.
  const spriteNode = useMemo(() => {
    const props = node.properties as TouchScreenButtonProperties;
    return props.texture_normal ? asUncentredSprite(node, props, props.texture_normal) : null;
  }, [node]);

  if (!spriteNode) return <Node2D node={node}>{children}</Node2D>;
  return <Sprite2D node={spriteNode}>{children}</Sprite2D>;
}
