/**
 * <Camera2D> — a Node2D that defines the 2D view. Renders no geometry; it
 * positions its children via the 2D transform and tags its group with
 * `userData.camera2d` (world position + zoom/offset/anchor) so the 2D-mode
 * orthographic camera can frame the view on it. (V1 framing is fit-to-content;
 * the tag lets a later step honor the Camera2D's own framing.)
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { node2dGroupProps, Z_INDEX_STEP } from '../../../r3f/node2dTransform';
import type { Camera2DProperties } from './types';

export function Camera2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Camera2DProperties;
  const { position, rotation, scale } = useMemo(
    () => node2dGroupProps(props, props.z_index * Z_INDEX_STEP),
    [props]
  );
  const visible = props.visible !== false;
  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      userData={{
        camera2d: {
          zoom: props.zoom,
          offset: props.offset,
          anchorMode: props.anchor_mode,
          enabled: props.enabled,
        },
      }}
    >
      {children}
    </group>
  );
}
