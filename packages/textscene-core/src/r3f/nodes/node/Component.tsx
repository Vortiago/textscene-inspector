/**
 * <Node> — base Godot Node. Renders children inside a `<group>` and
 * applies an optional Transform3D when the parsed node carries one.
 *
 * WI-HALL-4: Pre-fix the component dropped the transform entirely. The
 * `Node` fallback type is what `parseNodeWithRegistry` assigns to any
 * TSCN node that has no explicit `type` attribute — including
 * instance-only nodes like `[node name="LetterOpener"
 * parent="..." instance=ExtResource("...")]`. In Godot those instance
 * nodes still carry a `transform = Transform3D(...)` property, and
 * the parsed node's `properties.transform` slot DOES get populated by
 * the base `parseNode`. But because the R3F component ignored
 * `properties.transform`, the LetterOpener evidence node — which has
 * a uniform 0.025 scale baked into its transform basis — rendered
 * its underlying GLB at full size (~40× too big in the hallway
 * fixture).
 *
 * Fix: thread `properties.transform` through `transformFromNode3DProperties`
 * (the same helper Node3D uses) and apply position / rotation / scale
 * to the wrapping `<group>`. For nodes that genuinely have no
 * transform — purely-organisational `Node` containers from `Node`
 * subclasses in 2D scenes, or test scaffolding — the helper returns
 * the identity transform, so the `<group>` is a no-op.
 */

import { useMemo } from 'react';
import type { NodeProperties } from '../../../nodes/node/types';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';

export function Node({ node, children }: NodeComponentProps) {
  // The base Node parser populates `transform` on Node3D-derived
  // instance nodes; `transformFromNode3DProperties` accepts the
  // Node3DProperties superset, which includes the `transform?` slot
  // that NodeProperties shares. Identity transform when absent.
  const props = node.properties as NodeProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(props),
    [props]
  );
  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {children}
    </group>
  );
}
