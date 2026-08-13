/**
 * <Camera2D> — a Node2D that defines the 2D view. Renders no geometry; it
 * positions its children via the 2D transform and tags its group with
 * `userData.camera2d`, the camera's whole parsed framing surface, so a consumer
 * holding the Object3D can frame a view on it without re-reading the scene.
 *
 * The tag carries no position: the group IS the camera, so a consumer reads the
 * position off its world matrix (`getWorldPosition`), which resolves an
 * instanced sub-scene's transform for free.
 *
 * A sub-viewport's 2D pass is the consumer (`selectViewportCamera2D`); the main
 * 2D stage still frames fit-to-content (ADR-0006).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { node2dGroupProps, node2dGroupSpread } from '../../../r3f/node2dTransform';
import { useCanvasItemRenderOrder } from '../../../r3f/contexts/PaintOrderContext';
import { accumulateCanvasItemZ, useEffectiveZ } from '../../../r3f/lighting2d/canvasItemPlacement';
import type { Camera2DTag } from './cameraView';
import type { Camera2DProperties } from './types';

export function Camera2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Camera2DProperties;
  const transform = useMemo(() => node2dGroupSpread(node2dGroupProps(props)), [props]);
  // Drawn outside `<CanvasItem2D>`, so it takes the shared draw-order key
  // directly rather than deriving a second one of its own.
  const renderOrder = useCanvasItemRenderOrder(node, accumulateCanvasItemZ(useEffectiveZ(), props));
  const visible = props.visible !== false;
  return (
    <group
      name={node.name}
      {...transform}
      visible={visible}
      renderOrder={renderOrder}
      userData={{
        camera2d: {
          zoom: props.zoom,
          offset: props.offset,
          anchor_mode: props.anchor_mode,
          limitLeft: props.limitLeft,
          limitTop: props.limitTop,
          limitRight: props.limitRight,
          limitBottom: props.limitBottom,
          limitEnabled: props.limitEnabled,
          enabled: props.enabled,
        } satisfies Camera2DTag,
      }}
    >
      {children}
    </group>
  );
}
