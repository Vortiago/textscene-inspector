import { usePendingWork } from '../../../resources/usePendingWork.js';
import { textureWork } from '../../../resources/textures/textureWork.js';
import { StatusChip } from './StatusChip.js';
import { SCENE_LOAD_STATUS_TESTID } from './statusTestIds.js';
import type { ViewSettle } from './viewSettle.js';

interface SceneLoadStatusProps {
  settle: ViewSettle;
  hasScene: boolean;
  /** The error the viewport's boundary caught: a crashed viewport loads nothing. */
  viewportError: Error | null;
}

// The texture work status covers the textures, so the two never show at once.
export function SceneLoadStatus({ settle, hasScene, viewportError }: SceneLoadStatusProps) {
  const pendingTextures = usePendingWork(textureWork);
  if (!hasScene || settle.status !== 'pending' || pendingTextures > 0 || viewportError) return null;
  return <StatusChip label="Loading scene…" testId={SCENE_LOAD_STATUS_TESTID} />;
}
