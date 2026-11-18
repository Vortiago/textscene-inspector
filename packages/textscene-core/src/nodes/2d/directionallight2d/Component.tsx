/**
 * DirectionalLight2D draws nothing on the canvas, as in Godot: it adds one term over the whole
 * accumulation buffer every lit canvas item multiplies its albedo against
 * (`r3f/lighting2d/CanvasLight2D`). CanvasItem2D supplies transform, `visible` and z.
 */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import type { DirectionalLight2DProperties } from './types';
import { CanvasLight2D } from '../../../r3f/lighting2d/CanvasLight2D';
import { useLight2DEnabled } from '../lights/shared/useLight2DEnabled';

export function DirectionalLight2D({ node, children }: NodeComponentProps) {
  const props = node.properties as DirectionalLight2DProperties;
  const isEnabled = useLight2DEnabled(props);

  // A disabled light still draws its children: `enabled` switches the light alone.
  return (
    <CanvasItem2D
      node={node}
      props={props}
      // A light draws no pixels of its own, so its quads read no light and give the per-item cap no rect.
      ownItems={() =>
        isEnabled ? (
          <CanvasLight2D
            term={{
              kind: 'directional',
              color: props.color,
              energy: props.energy,
              blendMode: props.blend_mode,
              height: props.height,
              maxDistance: props.max_distance,
              layerMin: props.range_layer_min,
              layerMax: props.range_layer_max,
              shadow: {
                enabled: props.shadow_enabled,
                itemCullMask: props.shadow_item_cull_mask,
                color: props.shadow_color,
                filter: props.shadow_filter,
                filterSmooth: props.shadow_filter_smooth,
              },
            }}
          />
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}
