import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { node2dGroupProps, node2dGroupSpread } from '../../../r3f/node2dTransform';
import { node2dZStep, useCanvasKeyOfNode } from '../../../r3f/canvasItemState';
import type { Camera2DTag } from '../../../r3f/viewportRender/camera2DView';
import type { Camera2DProperties } from './types';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';

export function Camera2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Camera2DProperties;
  const transform = useMemo(() => node2dGroupSpread(node2dGroupProps(props)), [props]);
  // Drawn outside `<CanvasItem2D>`, so it takes the shared draw-order key
  // directly rather than deriving a second one of its own.
  const renderOrder = useCanvasKeyOfNode(node, node2dZStep(props));
  const visible = props.visible !== false;
  const tscnPath = useNodePath() ?? node.name;
  return (
    <group
      name={node.name}
      {...transform}
      visible={visible}
      renderOrder={renderOrder}
      userData={{
        tscnPath,
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
