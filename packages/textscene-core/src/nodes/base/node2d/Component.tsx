/**
 * <Node2D> — invisible 2D transform container. Maps the Godot 2D transform
 * onto a <group> (see node2dTransform: conjugation by diag(1,-1,1) so +Y-down
 * content renders right-side-up and composes through nesting), and offsets
 * along +Z by z_index for draw order. Children render inside the group.
 */

import { useMemo } from 'react';
import type { Node2DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { node2dGroupProps, Z_INDEX_STEP } from '../../../r3f/node2dTransform';

export function Node2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Node2DProperties;
  const { position, rotation, scale } = useMemo(
    () => node2dGroupProps(props, props.z_index * Z_INDEX_STEP),
    [props]
  );
  const visible = props.visible !== false;
  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale} visible={visible}>
      {children}
    </group>
  );
}
