/**
 * <CanvasGroup>: a Node2D whose children at its `z_final` draw into one buffer, which a single rect
 * then composites over the canvas (`renderer_canvas_cull.cpp:196-256`). The group's `modulate`
 * reaches the children and the rect, so its alpha applies twice. Its `self_modulate` reaches the
 * rect alone.
 */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import type { TscnNode } from '../../../parser/types';
import { Node2D } from '../../base/node2d/Component';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { node2dZStep, useCanvasRunKeysOfNode } from '../../../r3f/canvasItemState';
import { CompositeGroupRect } from '../../../r3f/canvasGroup/CompositeGroupRect';
import type { CanvasGroupProperties } from './types';

export function CanvasGroup({ node, children }: NodeComponentProps) {
  // A y-sorted group takes the y-sort branch, which groups nothing (`renderer_canvas_cull.cpp:437-469`):
  // measured on 4.6.3, its children draw as a plain Node2D's and its `self_modulate` changes nothing.
  if ((node.properties as CanvasGroupProperties).y_sort_enabled)
    return <Node2D node={node}>{children}</Node2D>;
  return <CompositingGroup node={node}>{children}</CompositingGroup>;
}

function CompositingGroup({ node, children }: { node: TscnNode; children?: React.ReactNode }) {
  const props = node.properties as CanvasGroupProperties;
  const window = useCanvasRunKeysOfNode(node, node2dZStep(props));
  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ tint, material, pixelMaterial }) => (
        <CompositeGroupRect
          window={window}
          tint={tint}
          material={material}
          pixelMaterial={pixelMaterial}
          fitMargin={props.fit_margin}
          clearMargin={props.clear_margin}
        />
      )}
    >
      {children}
    </CanvasItem2D>
  );
}
