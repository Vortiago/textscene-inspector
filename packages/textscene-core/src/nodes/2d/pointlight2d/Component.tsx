/**
 * PointLight2D draws nothing on the canvas, as in Godot: it adds its light texture to the
 * accumulation buffer every lit canvas item multiplies its albedo against
 * (`r3f/lighting2d/CanvasLight2D`). CanvasItem2D supplies transform, `visible` and z.
 */

import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { useTexture2D } from '../../../resources/useTexture2D';
import { useNodeReference } from '../../../resources/reading';
import type { ViewSampler } from '../../../resources/textures/textureView';
import { usePublishEditRect } from '../../../r3f/editRect/editRects';
import { pointLight2DEditRect } from '../../../r3f/editRect/nodeEditRects';
import { useTextureView } from '../../../r3f/useTextureView';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import type { PointLight2DProperties } from './types';
import { CanvasLight2D } from '../../../r3f/lighting2d/CanvasLight2D';
import { useLight2DEnabled } from '../lights/shared/useLight2DEnabled';

/**
 * Godot resolves a canvas item's DEFAULT repeat to the viewport's DISABLED default
 * (`viewport.h:419-420`, `renderer_canvas_render_rd.cpp:2344`), and the light-texture
 * tap uses that item sampler (`canvas.glsl:774-782`). The light texture states clamp and never
 * inherits a Repeat from the shared producer. A clamp-tagged entry is reused as it is.
 */
const COOKIE_SAMPLER: ViewSampler = { colorSpace: THREE.NoColorSpace, wrap: THREE.ClampToEdgeWrapping };

export function PointLight2D({ node, children }: NodeComponentProps) {
  const props = node.properties as PointLight2DProperties;
  const isEnabled = useLight2DEnabled(props);

  // `useTexture2D` resolves a GradientTexture2D, a gradient-less one to Godot's placeholder at its
  // own size (`renderer_viewport.cpp:455-460`). The plain view, as `COOKIE_SAMPLER` reads texels raw.
  const scope = useSceneResources();
  const slot = useTexture2D(useNodeReference(props.texture, scope), 'plain');
  // A light that draws no quad makes no view: it would clone and upload a light texture nothing draws.
  const cookie = useTextureView(isEnabled && !slot.missing ? slot.texture : null, COOKIE_SAMPLER);
  usePublishEditRect(pointLight2DEditRect(slot.size, props.texture_scale, props.offset));

  // A disabled light still draws its children: `enabled` switches the light alone. With no light
  // texture, also one whose file fails to load, the light adds nothing and draws nothing, as Godot's
  // loader leaves the property null (`resource_format_text.cpp:146-154`).
  return (
    <CanvasItem2D
      node={node}
      props={props}
      // A light draws no pixels of its own, so its quads read no light and give the per-item cap no rect.
      ownItems={() =>
        cookie ? (
          <CanvasLight2D
            term={{
              kind: 'point',
              cookie,
              color: props.color,
              energy: props.energy,
              blendMode: props.blend_mode,
              height: props.height,
              textureScale: props.texture_scale,
              offset: props.offset,
              itemCullMask: props.range_item_cull_mask,
              zMin: props.range_z_min,
              zMax: props.range_z_max,
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
