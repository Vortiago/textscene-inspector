/**
 * The outline of a TouchScreenButton's collision `shape`, which the editor draws over the button while
 * `shape_visible` holds (`touch_screen_button.cpp:151-171`). It follows CollisionShape2D: an outline
 * gizmo in the project's collision colour, shown only while Visible Collision Shapes is on.
 */

import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { useTexture2D } from '../../../resources/useTexture2D';
import { CollisionGizmo2D } from '../../physics/2d/collisionshape2d/CollisionGizmo2D';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../physics/shared/debugColor';
import type { TouchScreenButtonProperties } from './types';

export function ShapeOverlay({ props }: { props: TouchScreenButtonProperties }) {
  const sceneResources = useSceneResources();
  const { showCollisions } = useViewportMode();
  const shape = useSubOrExtResource(props.shape, sceneResources)?.resource;
  const { texture } = useTexture2D(
    props.texture_normal,
    sceneResources.externalResources,
    sceneResources.internalResources
  );
  const color = useGodotLinearColor(DEFAULT_COLLISION_DEBUG_COLOR);

  if (!showCollisions || !props.shape_visible || !shape) return null;

  // The centre is the texture's own half size, and only a valid `texture_normal` has one (cpp:158-160).
  const image = texture?.image as { width: number; height: number } | undefined;
  const centre = props.shape_centered && image ? { x: image.width / 2, y: image.height / 2 } : { x: 0, y: 0 };
  return (
    <group position={[centre.x, -centre.y, 0]}>
      <CollisionGizmo2D shape={shape} color={color} />
    </group>
  );
}
