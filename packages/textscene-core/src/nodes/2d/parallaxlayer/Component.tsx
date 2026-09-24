/**
 * Draws a ParallaxLayer: a Node2D whose pose its parent ParallaxBackground may
 * overwrite. The authored pose stays on `<Node2D>`, and a wrapper group holds
 * only the scroll delta (`parallaxLayerDelta`), at identity until posed.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { Node2D } from '../../base/node2d/Component';
import { parallaxMirrorOffsets } from '../parallaxbackground/parallaxScroll';
import { useParallaxScrollRegistry } from '../parallaxbackground/scrollContext';
import type { ParallaxLayerProperties } from './types';

export function ParallaxLayer({ node, children }: NodeComponentProps) {
  const props = node.properties as ParallaxLayerProperties;
  const path = useNodePath() ?? node.name;
  const registry = useParallaxScrollRegistry();
  const groupRef = useRef<THREE.Group>(null);

  const motion = useMemo(
    () => ({
      motion_scale: props.motion_scale,
      motion_offset: props.motion_offset,
      motion_mirroring: props.motion_mirroring,
    }),
    [props.motion_scale, props.motion_offset, props.motion_mirroring]
  );
  const origin = useMemo(() => ({ position: props.position }), [props.position]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || !registry) return;
    // `_update_scroll` poses `get_child(i)`, so only a direct child qualifies.
    // React context alone would also reach a layer nested under a Node2D.
    const parentPath = path.slice(0, Math.max(0, path.lastIndexOf('/')));
    if (parentPath !== registry.parentPath) return;
    return registry.register(path, { group, motion, origin });
  }, [registry, path, motion, origin]);

  // Godot repeats the canvas item, so the mirror offsets are in the layer's own
  // local space and every copy shares the one authored transform.
  const mirrors = useMemo(
    () => parallaxMirrorOffsets(props.motion_mirroring, props.scale),
    [props.motion_mirroring, props.scale]
  );

  return (
    // paint-order-safe: outside `<Node2D>`'s own wrapper, which is nearer to
    // every mesh below and so is the group three reads the key from.
    <group ref={groupRef}>
      <Node2D node={node}>
        {mirrors.length === 0
          ? children
          : mirrors.map((offset, index) => (
              // paint-order-safe: wraps dispatched children, each of which
              // brings its own canvas-item wrapper nearer than this one.
              <group key={`mirror-${index}`} position={[offset.x, 0 - offset.y, 0]}>
                {children}
              </group>
            ))}
      </Node2D>
    </group>
  );
}
