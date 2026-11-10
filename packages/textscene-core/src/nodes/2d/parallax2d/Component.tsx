/**
 * Draws a Parallax2D: a Node2D whose position `_update_scroll` replaces each pass. The authored
 * pose stays on `<Node2D>`, a wrapper group holds only the delta to the scroll position, and the
 * children draw once per repeat copy.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useViewportSize } from '../../../r3f/contexts/ViewportSizeContext';
import { observeSceneCamera } from '../../../r3f/sceneRenderCamera';
import { Node2D } from '../../base/node2d/Component';
import { currentCameraFraming } from '../parallaxbackground/currentCameraFraming';
import { parallaxRepeatOffsets } from '../parallaxbackground/parallaxScroll';
import { parallax2DCameraScreenOffset, parallax2DPosition } from './parallax2dScroll';
import { RepeatCopies, useIsRepeatBaseCopy } from '../parallaxbackground/RepeatCopies';
import type { Parallax2DProperties } from './types';

export function Parallax2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Parallax2DProperties;
  const scene = useThree((state) => state.scene);
  const viewportSize = useViewportSize();
  const isOuterBaseCopy = useIsRepeatBaseCopy();
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    return observeSceneCamera(scene, (camera) => {
      const group = groupRef.current;
      if (!group) return;

      // The camera writes `screen_offset` unless `ignore_camera_scroll` is on
      // (`parallax_2d.cpp:84-96`); the main 2D stage frames no camera.
      const view = props.ignore_camera_scroll ? null : currentCameraFraming(scene, camera);
      const screenOffset = view ? parallax2DCameraScreenOffset(view) : props.screen_offset;
      const position = parallax2DPosition(props, screenOffset, viewportSize, props.scale);
      const x = position.x - props.position.x;
      const y = 0 - (position.y - props.position.y);
      if (group.position.x === x && group.position.y === y) return;

      group.position.set(x, y, 0);
      group.updateMatrixWorld(true);
    });
  }, [scene, props, viewportSize]);

  const copies = useMemo(
    () => parallaxRepeatOffsets(props.repeat_size, props.repeat_times),
    [props.repeat_size, props.repeat_times]
  );

  const isRepeatSource = copies.length > 0;
  if (isRepeatSource && !isOuterBaseCopy) return null;

  return (
    // paint-order-safe: outside `<Node2D>`'s own wrapper, which is nearer to
    // every mesh below and so is the group three reads the key from.
    <group ref={groupRef}>
      <Node2D node={node}>
        {isRepeatSource ? <RepeatCopies offsets={copies}>{children}</RepeatCopies> : children}
      </Node2D>
    </group>
  );
}
