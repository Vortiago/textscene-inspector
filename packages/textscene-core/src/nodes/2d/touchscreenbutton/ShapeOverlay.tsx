/**
 * The drawing of a TouchScreenButton's collision `shape`, which the editor draws over the button while
 * `shape_visible` holds (`touch_screen_button.cpp:151-171`). It follows CollisionShape2D: the shape's
 * drawing in the project's collision colour, shown only while Visible Collision Shapes is on.
 */

import { useMemo } from 'react';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useNodeResource } from '../../../resources/reading';
import { SHAPE_2D } from '../../../resources/shapes/shape2d';
import { useTexture2D } from '../../../resources/useTexture2D';
import { useNodeReference } from '../../../resources/reading';
import { ShapeGizmo2D } from '../../physics/2d/collisionshape2d/ShapeGizmo2D';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../physics/shared/debugColor';
import type { TouchScreenButtonProperties } from './types';

export function ShapeOverlay({ props }: { props: TouchScreenButtonProperties }) {
  const { showCollisions } = useViewportMode();
  const shape = useNodeResource(props.shape, SHAPE_2D);
  const scope = useSceneResources();
  const { texture } = useTexture2D(useNodeReference(props.texture_normal, scope));
  const parts = useMemo(
    () => (shape.value ? [{ drawing: shape.value, colour: DEFAULT_COLLISION_DEBUG_COLOR }] : []),
    [shape.value]
  );

  if (!showCollisions || !props.shape_visible || parts.length === 0) return null;

  // The centre is the texture's own half size, and only a valid `texture_normal` has one (cpp:158-160).
  const image = texture?.image as { width: number; height: number } | undefined;
  const centre = props.shape_centered && image ? { x: image.width / 2, y: image.height / 2 } : { x: 0, y: 0 };
  return (
    <CanvasItemGroup position={[centre.x, -centre.y, 0]}>
      <ShapeGizmo2D parts={parts} />
    </CanvasItemGroup>
  );
}
