/**
 * The top-bar status while the current scene is not yet whole: the canvas has yet to render it,
 * or a resource it uses is still on its way. It shows from the scene's first render, so a harness
 * that waits for it to detach cannot pass between the scene's arrival and its first frame. The
 * texture work status covers the textures, so the two never show at once.
 */
import { StatusChip } from './StatusChip.js';
import { SCENE_LOAD_STATUS_TESTID } from './statusTestIds.js';
import { useSceneLoad } from './useSceneLoad.js';

/** `viewportError` is the error the viewport's boundary caught: a crashed viewport loads nothing. */
export function SceneLoadStatus({ viewportError }: { viewportError: Error | null }) {
  const { hasScene, isComplete, pendingTextures } = useSceneLoad();
  if (!hasScene || isComplete || pendingTextures > 0 || viewportError) return null;
  return <StatusChip label="Loading scene…" testId={SCENE_LOAD_STATUS_TESTID} />;
}
