/**
 * The top-bar status while the current scene is not yet whole: the canvas has yet to render it,
 * or a resource it uses is still on its way. It shows from the scene's first render, so a harness
 * that waits for it to detach cannot pass before loading starts. The texture work status covers
 * the textures, so the two never show at once.
 */
import { usePendingTextureWork } from '../../../resources/usePendingTextureWork.js';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { StatusChip } from './StatusChip.js';
import { SCENE_LOAD_STATUS_TESTID } from './statusTestIds.js';
import { useIsSceneComplete } from './useIsSceneComplete.js';

/** `viewportError` is the error the viewport's boundary caught: a crashed viewport loads nothing. */
export function SceneLoadStatus({ viewportError }: { viewportError: Error | null }) {
  const hasScene = (useOptionalHierarchy()?.sceneGraph ?? null) !== null;
  const isComplete = useIsSceneComplete();
  const pendingTextures = usePendingTextureWork();
  if (!hasScene || isComplete || pendingTextures > 0 || viewportError) return null;
  return <StatusChip label="Loading scene…" testId={SCENE_LOAD_STATUS_TESTID} />;
}
