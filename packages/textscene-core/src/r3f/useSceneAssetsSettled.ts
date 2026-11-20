/**
 * Whether the resources, textures and scene fonts a scene uses have all arrived. It needs no
 * viewport shell, so a canvas mounted alone answers it too.
 */
import { usePendingResourceCount } from '../resources/usePendingResourceCount.js';
import { usePendingWork } from '../resources/usePendingWork.js';
import { textureWork } from '../resources/textures/textureWork.js';
import { fontWork } from './controls/native/text/settledChannel.js';

export function useSceneAssetsSettled(): boolean {
  // Every hook runs on every render, so React sees one hook order.
  const pendingResources = usePendingResourceCount();
  const pendingTextures = usePendingWork(textureWork);
  const pendingFontWork = usePendingWork(fontWork);
  return pendingResources === 0 && pendingTextures === 0 && pendingFontWork === 0;
}
